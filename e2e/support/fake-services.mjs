// @ts-check
// Local stand-ins for Supabase Auth and the Gize Admin API, started by Playwright (playwright.config.ts)
// so signed-in flows run in CI without real services or secrets (W1 decision). They answer only
// what the portal uses, in the shapes supabase-js and the contract expect.
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { FAKE_API_PORT, FAKE_SUPABASE_PORT, testUsers } from "./test-users.mjs";

/**
 * @typedef {import("./test-users.mjs").TestUser} TestUser
 * @typedef {import("../../src/lib/api/schema").components["schemas"]} Schemas
 * @typedef {import("node:http").IncomingMessage} IncomingMessage
 * @typedef {import("node:http").ServerResponse} ServerResponse
 */

/** @type {TestUser[]} */
const users = Object.values(testUsers);
const JWT_SECRET = "e2e-dummy-secret";
const ACCESS_TOKEN_SECONDS = 3600;

/**
 * Like Supabase Auth: a sign-in starts a session; its access tokens carry the session ID and
 * expire; each refresh token works once (rotation); logout ends the session.
 * @type {Map<string, { user: TestUser, refreshToken: string, active: boolean }>}
 */
const sessions = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version, idempotency-key, x-request-id",
  // Like the real services: the API exposes these two; Supabase Auth exposes its API version,
  // which supabase-js needs to read error codes such as invalid_credentials.
  "Access-Control-Expose-Headers":
    "X-Request-ID, Retry-After, X-Supabase-Api-Version",
};

/**
 * @param {ServerResponse} response
 * @param {number} status
 * @param {unknown} [body]
 * @param {Record<string, string>} [headers]
 */
function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...corsHeaders,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...headers,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

/**
 * @param {IncomingMessage} request
 * @returns {Promise<Record<string, unknown>>}
 */
async function readJson(request) {
  let text = "";
  for await (const chunk of request) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** @param {IncomingMessage} request */
function bearer(request) {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

/** @param {string} value */
const base64url = (value) => Buffer.from(value).toString("base64url");

/** @param {string} token @returns {Record<string, unknown> | null} verified, unexpired payload */
function verifyAccessToken(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (signature !== expected) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return typeof claims.exp === "number" && claims.exp > Date.now() / 1000
    ? claims
    : null;
}

/** @param {TestUser} user */
function supabaseUserId(user) {
  return typeof user.staff === "object"
    ? user.staff.id
    : "00000000-0000-4000-8000-0000000000ff";
}

/**
 * A well-formed HS256 JWT (supabase-js decodes the access token); the secret is a dummy.
 * @param {TestUser} user
 * @param {string} sessionId
 */
function accessToken(user, sessionId) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: supabaseUserId(user),
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + ACCESS_TOKEN_SECONDS,
      session_id: sessionId,
    }),
  );
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** @param {TestUser} user */
function supabaseUser(user) {
  return {
    id: supabaseUserId(user),
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-01T00:00:00Z",
  };
}

/**
 * New tokens for a session (a new one at sign-in, the same one on refresh).
 * @param {TestUser} user
 * @param {string} [sessionId]
 */
function issueTokens(user, sessionId = randomUUID()) {
  const refreshToken = randomUUID();
  sessions.set(sessionId, { user, refreshToken, active: true });
  return {
    access_token: accessToken(user, sessionId),
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_SECONDS,
    refresh_token: refreshToken,
    user: supabaseUser(user),
  };
}

/** @param {IncomingMessage} request the active session of the request's access token, if any */
function activeSession(request) {
  const claims = verifyAccessToken(bearer(request));
  const session = claims ? sessions.get(String(claims.session_id)) : undefined;
  return session?.active
    ? { ...session, id: String(claims?.session_id) }
    : null;
}

/**
 * Supabase Auth's error shape for API version 2024-01-01.
 * @param {ServerResponse} response
 * @param {number} status
 * @param {string} code
 * @param {string} msg
 */
function authError(response, status, code, msg) {
  send(
    response,
    status,
    { code, msg },
    { "X-Supabase-Api-Version": "2024-01-01" },
  );
}

let refreshCount = 0;

const supabase = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "OPTIONS") return send(response, 204);

  if (request.method === "POST" && url.pathname === "/auth/v1/token") {
    const body = await readJson(request);
    const grantType = url.searchParams.get("grant_type");
    if (grantType === "password") {
      const user = users.find(
        (candidate) =>
          candidate.email === String(body.email ?? "").toLowerCase() &&
          candidate.password === body.password,
      );
      if (!user) {
        return authError(
          response,
          400,
          "invalid_credentials",
          "Invalid login credentials",
        );
      }
      return send(response, 200, issueTokens(user));
    }
    if (grantType === "refresh_token") {
      const entry = [...sessions.entries()].find(
        ([, session]) =>
          session.active && session.refreshToken === body.refresh_token,
      );
      if (!entry) {
        return authError(
          response,
          400,
          "refresh_token_not_found",
          "Invalid Refresh Token",
        );
      }
      refreshCount += 1;
      return send(response, 200, issueTokens(entry[1].user, entry[0]));
    }
  }

  if (request.method === "GET" && url.pathname === "/auth/v1/user") {
    const session = activeSession(request);
    if (!session) return authError(response, 403, "bad_jwt", "invalid JWT");
    return send(response, 200, supabaseUser(session.user));
  }

  if (request.method === "POST" && url.pathname === "/auth/v1/logout") {
    // Ends the session and its refresh token; the access token itself stays valid until it
    // expires, as with the real API.
    const session = activeSession(request);
    if (session) sessions.set(session.id, { ...session, active: false });
    return send(response, 204);
  }

  // e2e only: how many refreshes happened, so a test can prove one did.
  if (request.method === "GET" && url.pathname === "/__e2e/refresh-count") {
    return send(response, 200, { refreshCount });
  }

  authError(response, 404, "not_found", "Not handled by the e2e stand-in");
});

/**
 * @param {ServerResponse} response
 * @param {number} status
 * @param {Schemas["ErrorCode"]} code
 */
function problem(response, status, code) {
  const requestId = `e2e-${randomUUID().slice(0, 8)}`;
  /** @type {Schemas["Problem"]} */
  const body = {
    type: "about:blank",
    title: code,
    status,
    code,
    request_id: requestId,
  };
  send(response, status, body, {
    "Content-Type": "application/problem+json",
    "X-Request-ID": requestId,
  });
}

/**
 * @param {ServerResponse} response
 * @param {string} field JSON pointer, e.g. "/name"
 * @param {Schemas["ValidationReason"]} reason
 * @param {"body" | "query"} [location]
 */
function validationProblem(response, field, reason, location = "body") {
  const requestId = `e2e-${randomUUID().slice(0, 8)}`;
  /** @type {Schemas["ValidationProblem"]} */
  const body = {
    type: "about:blank",
    title: "VALIDATION_FAILED",
    status: 422,
    code: "VALIDATION_FAILED",
    request_id: requestId,
    errors: [{ location, field, reason }],
    errors_truncated: false,
  };
  send(response, 422, body, {
    "Content-Type": "application/problem+json",
    "X-Request-ID": requestId,
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The request's Idempotency-Key, like the API: a UUID in its canonical lowercase form, or a 428.
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @returns {string | undefined} the key, or undefined after the 428
 */
function idempotencyKey(request, response) {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !UUID.test(key) || key !== key.toLowerCase()) {
    problem(response, 428, "IDEMPOTENCY_KEY_REQUIRED");
    return undefined;
  }
  return key;
}

// Areas, like GZ-026: names unique ignoring case, newest first, `q` matches the start of a name.
/** @typedef {Schemas["AreaRead"]} FakeArea */
/** @type {FakeArea[]} */
const areas = [
  "Ayat",
  "Bole",
  "CMC",
  "Megenagna",
  "Mexico",
  "Piassa",
  "ጦር ኃይሎች",
  "ሳሪስ",
].map((name, index) => {
  const at = new Date(Date.UTC(2026, 9, 1, 6, index)).toISOString();
  return {
    id: `00000000-0000-4000-a000-${String(index + 1).padStart(12, "0")}`,
    name,
    created_at: at,
    updated_at: at,
  };
});
/**
 * "staff email|Idempotency-Key" → what create returned and a fingerprint of the request: a retry
 * gets the same answer, the same key with another body is refused, like the API (per caller).
 * @type {Map<string, { area: FakeArea; fingerprint: string }>}
 */
const areaKeys = new Map();

/** @param {FakeArea} area @returns {Schemas["AreaRead"]} */
function areaRead({ id, name, created_at, updated_at }) {
  return { id, name, created_at, updated_at };
}

/** Like the API's `same_looking`: NFC, and single ordinary spaces between words. @param {string} value */
function sameLooking(value) {
  return value.normalize("NFC").split(/\s+/).filter(Boolean).join(" ");
}

/** @param {string} name @param {string} [exceptId] */
function areaNameTaken(name, exceptId) {
  return areas.some(
    (area) =>
      area.id !== exceptId && area.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * @param {ServerResponse} response
 * @param {unknown} raw
 * @returns {string | undefined} the name as the API stores it, or undefined after sending a 422
 */
function validAreaName(response, raw) {
  if (typeof raw !== "string") {
    validationProblem(response, "/name", "missing");
    return undefined;
  }
  const name = sameLooking(raw);
  if (name === "") {
    validationProblem(response, "/name", "too_short");
    return undefined;
  }
  if (name.length > 100) {
    validationProblem(response, "/name", "too_long");
    return undefined;
  }
  return name;
}

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listAreas(url, response) {
  // A blank `q` means no filter, like the API.
  const q = url.searchParams.get("q")?.trim() || null;
  if (q !== null && q.length > 100) {
    return validationProblem(response, "/q", "too_long", "query");
  }
  const limit = Number(url.searchParams.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return validationProblem(response, "/limit", "out_of_range", "query");
  }
  const cursor = url.searchParams.get("cursor");
  const offset =
    cursor === null ? 0 : Number(Buffer.from(cursor, "base64url").toString());
  if (cursor === "" || !Number.isInteger(offset) || offset < 0) {
    return problem(response, 422, "INVALID_CURSOR");
  }
  const matching = areas
    .filter(
      (area) =>
        q === null || area.name.toLowerCase().startsWith(q.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const items = matching.slice(offset, offset + limit).map(areaRead);
  /** @type {Schemas["AreaPage"]} */
  const page = {
    items,
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// Corridors, like GZ-020: origin → destination (the way back is another corridor), a pair at most
// once, newest first, filters by origin and destination area.
/**
 * @typedef {{ id: string; originId: string; destinationId: string; created_at: string;
 *   updated_at: string }} FakeCorridor
 */
/** @param {string} name */
function areaId(name) {
  const area = areas.find((candidate) => candidate.name === name);
  if (!area) throw new Error(`no seeded area ${name}`);
  return area.id;
}
/** @type {FakeCorridor[]} */
const corridors = [
  ["Bole", "Piassa"],
  ["Piassa", "Bole"],
  ["Megenagna", "Mexico"],
  ["Ayat", "CMC"],
  ["ሳሪስ", "Bole"],
].map(([origin, destination], index) => {
  const at = new Date(Date.UTC(2026, 9, 2, 6, index)).toISOString();
  return {
    id: `00000000-0000-4000-b000-${String(index + 1).padStart(12, "0")}`,
    originId: areaId(origin),
    destinationId: areaId(destination),
    created_at: at,
    updated_at: at,
  };
});
/** @type {Map<string, { corridor: FakeCorridor; fingerprint: string }>} */
const corridorKeys = new Map();

/** @param {string} id @returns {Schemas["AreaRef"]} */
function areaRef(id) {
  const area = areas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`corridor refers to a missing area ${id}`);
  return { id: area.id, name: area.name };
}

/** @param {FakeCorridor} corridor @returns {Schemas["CorridorRead"]} */
function corridorRead({ id, originId, destinationId, created_at, updated_at }) {
  return {
    id,
    origin_area: areaRef(originId),
    destination_area: areaRef(destinationId),
    created_at,
    updated_at,
  };
}

/** @param {string} originId @param {string} destinationId @param {string} [exceptId] */
function pairTaken(originId, destinationId, exceptId) {
  return corridors.some(
    (corridor) =>
      corridor.id !== exceptId &&
      corridor.originId === originId &&
      corridor.destinationId === destinationId,
  );
}

/**
 * Checks the area ids in a corridor body the way the API's model does (before any lookup):
 * at least one end on a change, no nulls, UUIDs, and two different areas.
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @param {{ partial: boolean }} options
 * @returns {boolean} false after sending a 422
 */
function corridorBodyValid(response, body, { partial }) {
  const fields = ["origin_area_id", "destination_area_id"];
  const unknown = Object.keys(body).find((key) => !fields.includes(key));
  if (unknown) {
    validationProblem(response, `/${unknown}`, "unknown_field");
    return false;
  }
  if (partial) {
    // PartialUpdate: something to change, and a field left out rather than null.
    const sent = fields.filter((field) => field in body);
    if (sent.length === 0 || sent.some((field) => body[field] === null)) {
      validationProblem(response, "", "invalid");
      return false;
    }
  }
  for (const field of fields) {
    const value = body[field];
    if (value === undefined && partial) continue;
    if (value === undefined) {
      validationProblem(response, `/${field}`, "missing");
      return false;
    }
    if (typeof value !== "string" || !UUID.test(value)) {
      validationProblem(response, `/${field}`, "invalid_format");
      return false;
    }
  }
  if (!partial && body.origin_area_id === body.destination_area_id) {
    validationProblem(response, "", "invalid");
    return false;
  }
  return true;
}

/**
 * The service's check: the area must exist (not deleted), or a 422 on its field.
 * @param {ServerResponse} response
 * @param {string} id
 * @param {"origin_area_id" | "destination_area_id"} field
 */
function areaExists(response, id, field) {
  if (areas.some((area) => area.id === id)) return true;
  validationProblem(response, `/${field}`, "invalid");
  return false;
}

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listCorridors(url, response) {
  /** @type {Record<string, string | null>} */
  const filters = {};
  for (const name of ["origin_area_id", "destination_area_id"]) {
    const value = url.searchParams.get(name);
    if (value !== null && !UUID.test(value)) {
      return validationProblem(response, `/${name}`, "invalid_format", "query");
    }
    filters[name] = value;
  }
  const limit = Number(url.searchParams.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return validationProblem(response, "/limit", "out_of_range", "query");
  }
  const cursor = url.searchParams.get("cursor");
  const offset =
    cursor === null ? 0 : Number(Buffer.from(cursor, "base64url").toString());
  if (cursor === "" || !Number.isInteger(offset) || offset < 0) {
    return problem(response, 422, "INVALID_CURSOR");
  }
  const matching = corridors
    .filter(
      (corridor) =>
        (filters.origin_area_id === null ||
          corridor.originId === filters.origin_area_id) &&
        (filters.destination_area_id === null ||
          corridor.destinationId === filters.destination_area_id),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  /** @type {Schemas["CorridorPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit).map(corridorRead),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// Companies, like GZ-029: names unique ignoring case, newest first, `q` matches the start of a name,
// `is_active` filters; contact phone stored E.164, email lower case, empty notes are none.
/** @typedef {Schemas["CompanyRead"]} FakeCompany */
/** @type {FakeCompany[]} */
const companies = [
  ["Addis Brewery", "Hana Bekele", "+251911234567", true],
  ["Ethio Ceramics", "Dawit Alemu", "+251922345678", true],
  ["Abyssinia Textiles", "Selam Tesfaye", "+251712345678", true],
  ["Bole Logistics", "Yonas Girma", "+251933456789", false],
].map(([name, contact, phone, active], index) => {
  const at = new Date(Date.UTC(2026, 9, 3, 6, index)).toISOString();
  return {
    id: `00000000-0000-4000-c000-${String(index + 1).padStart(12, "0")}`,
    name: String(name),
    contact_name: String(contact),
    contact_phone: String(phone),
    contact_email: `${String(contact).split(" ")[0]?.toLowerCase()}@example.test`,
    billing: /** @type {const} */ ("postpaid"),
    notes: index === 0 ? "Invoices to the finance office, 2nd floor." : null,
    is_active: Boolean(active),
    created_at: at,
    updated_at: at,
  };
});
/** @type {Map<string, { company: FakeCompany; fingerprint: string }>} */
const companyKeys = new Map();

/** @param {string} name */
function companyId(name) {
  const company = companies.find((candidate) => candidate.name === name);
  if (!company) throw new Error(`no seeded company ${name}`);
  return company.id;
}

// Routes, like GZ-021/GZ-023: codes stored upper case and unique, the type fixed (student: a
// school, corporate: an active company and no launch minimum), four times in order, newest first.
// Facts the stand-in can't derive (seats taken, riders, open requests) are fixed per route.
/**
 * @typedef {{
 *   id: string; code: string; corridorId: string; route_type: Schemas["RouteType"];
 *   school_name: string | null; companyId: string | null;
 *   morning_time: string; morning_arrival_time: string | null;
 *   return_time: string; return_arrival_time: string | null;
 *   servedAreaIds: string[]; seats: number; launch_minimum: number | null;
 *   prices: Schemas["Prices"] | null; status: Schemas["RouteStatus"];
 *   copied_from_route_id: string | null; taken: number; reserved: number;
 *   hasRiders: boolean; hasRequests: boolean; created_at: string; updated_at: string;
 *   laterReserved?: number;
 * }} FakeRoute
 */
/** @param {string} origin @param {string} destination */
function corridorId(origin, destination) {
  const corridor = corridors.find(
    (candidate) =>
      candidate.originId === areaId(origin) &&
      candidate.destinationId === areaId(destination),
  );
  if (!corridor)
    throw new Error(`no seeded corridor ${origin} → ${destination}`);
  return corridor.id;
}

/** @type {FakeRoute[]} */
const routes = [
  // Addis Brewery runs it: the company can't be deactivated or deleted.
  {
    code: "R-21",
    corridorId: corridorId("Bole", "Piassa"),
    route_type: "corporate",
    companyId: companyId("Addis Brewery"),
    status: "active",
    taken: 9,
    hasRiders: true,
  },
  // Ethio Ceramics' draft route: the company can be deactivated, not deleted.
  {
    code: "R-22",
    corridorId: corridorId("Megenagna", "Mexico"),
    route_type: "corporate",
    companyId: companyId("Ethio Ceramics"),
  },
  // Forming, priced, serving two areas, 7 of 10 reserved: corridor fixed (prices), seats ≥ 9.
  {
    code: "B-01",
    corridorId: corridorId("Bole", "Piassa"),
    route_type: "public",
    launch_minimum: 10,
    status: "forming",
    servedAreaIds: [areaId("Megenagna"), areaId("Mexico")],
    prices: { round_trip: 2400, one_way: 1400, saturday: 300 },
    taken: 9,
    reserved: 7,
    // 4 more riders start in later months: those months are ready (11 of 10), the earliest
    // isn't (the API judges a route's launch move for the earliest month only).
    laterReserved: 11,
    hasRiders: true,
  },
  // A student route made before arrival times existed.
  {
    code: "S-03",
    corridorId: corridorId("Megenagna", "Mexico"),
    route_type: "student",
    school_name: "Lycée Guebre-Mariam",
    launch_minimum: 8,
    seats: 20,
    morning_arrival_time: null,
    return_arrival_time: null,
    hasRequests: true,
  },
  // A van added from a route since deleted.
  {
    code: "B-02",
    corridorId: corridorId("Piassa", "Bole"),
    route_type: "public",
    launch_minimum: 10,
    copied_from_route_id: "00000000-0000-4000-d000-000000000999",
  },
  // Forming and ready to launch (6 of 5 reserved, priced). Two, one per Playwright project
  // (B-04 wide, B-05 narrow): the data is shared, and a launch can't be undone. The stand-in
  // can't reserve riders, so no test can make a route ready itself.
  ...["B-04", "B-05"].map((code) => ({
    code,
    corridorId: corridorId("Megenagna", "Mexico"),
    route_type: /** @type {const} */ ("public"),
    launch_minimum: 5,
    status: /** @type {const} */ ("forming"),
    prices: { round_trip: 2000, one_way: 1200, saturday: null },
    reserved: 6,
    hasRiders: true,
  })),
].map((seed, index) => {
  const at = new Date(Date.UTC(2026, 9, 4, 6, index)).toISOString();
  return {
    id: `00000000-0000-4000-d000-${String(index + 1).padStart(12, "0")}`,
    school_name: null,
    companyId: null,
    morning_time: "06:30",
    morning_arrival_time: "07:15",
    return_time: "17:30",
    return_arrival_time: "18:15",
    servedAreaIds: [],
    seats: 14,
    launch_minimum: null,
    prices:
      seed.route_type === "corporate"
        ? null
        : { round_trip: null, one_way: null, saturday: null },
    status: "draft",
    copied_from_route_id: null,
    taken: 0,
    reserved: 0,
    hasRiders: false,
    hasRequests: false,
    created_at: at,
    updated_at: at,
    ...seed,
  };
});

/** A live route runs on the corridor: its ends can't change, it can't be deleted. */
function corridorUsedByRoute(/** @type {string} */ id) {
  return routes.some((route) => route.corridorId === id);
}

// Status moves, like GZ-024/GZ-067: the moves each type of route may make, and what would refuse
// each now (the same checks the status endpoint makes, in its order).
const MOVES = {
  individual: [
    ["draft", "forming"],
    ["forming", "draft"],
    ["forming", "active"],
    ["active", "paused"],
    ["paused", "active"],
  ],
  corporate: [
    ["draft", "active"],
    ["active", "paused"],
    ["paused", "active"],
  ],
};

/** @param {FakeRoute} route */
function movesOf(route) {
  return MOVES[route.route_type === "corporate" ? "corporate" : "individual"];
}

/** Today in Addis Ababa (UTC+3, no daylight saving), like the API's `addis_today()`. */
function addisToday() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

/** The 1st of the month a launch may name first (today on the 1st), as YYYY-MM-DD. */
function nextLaunchDay() {
  const today = addisToday();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + (today.getUTCDate() === 1 ? 0 : 1);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/** Every launch day: the 1st of each month from the earliest to a year ahead. */
function launchDays() {
  const first = new Date(`${nextLaunchDay()}T00:00:00Z`);
  const latest = addisToday();
  latest.setUTCFullYear(latest.getUTCFullYear() + 1);
  const days = [];
  for (
    let at = first;
    at <= latest;
    at = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1))
  ) {
    days.push(at.toISOString().slice(0, 10));
  }
  return days;
}

/** @param {FakeRoute} route */
function companyInactive(route) {
  const company = companies.find(
    (candidate) => candidate.id === route.companyId,
  );
  return !company || !company.is_active;
}

/** @param {FakeRoute} route @returns {Schemas["StatusChange"][]} */
function statusChanges(route) {
  const corporate = route.route_type === "corporate";
  return movesOf(route)
    .filter(([from]) => from === route.status)
    .map(([, to]) => {
      /** @type {Schemas["RouteBlocker"][]} */
      const blocked = [];
      if (
        to === "forming" &&
        (route.prices?.round_trip == null || route.prices?.one_way == null)
      ) {
        blocked.push("PRICES_MISSING");
      }
      if (route.status === "forming" && to === "draft" && route.hasRiders) {
        blocked.push("ROUTE_HAS_RIDERS");
      }
      if (corporate && to === "active" && companyInactive(route)) {
        blocked.push("COMPANY_INACTIVE");
      }
      const launching = route.status === "forming" && to === "active";
      if (launching && route.reserved < (route.launch_minimum ?? 0)) {
        blocked.push("NOT_ENOUGH_RIDERS");
      }
      return {
        to: /** @type {Schemas["RouteStatus"]} */ (to),
        ready: blocked.length === 0,
        blocked_by: blocked,
        launch_date: launching ? nextLaunchDay() : null,
      };
    });
}

/** @param {FakeRoute} route @returns {Schemas["RouteRead"]} */
function routeRead(route) {
  // Names follow renames, like the API's joins.
  const corridor = corridors.find(
    (candidate) => candidate.id === route.corridorId,
  );
  const company = companies.find(
    (candidate) => candidate.id === route.companyId,
  );
  return {
    id: route.id,
    code: route.code,
    corridor: corridor
      ? {
          id: corridor.id,
          origin_area: areaRef(corridor.originId),
          destination_area: areaRef(corridor.destinationId),
        }
      : {
          id: route.corridorId,
          origin_area: { id: "", name: "?" },
          destination_area: { id: "", name: "?" },
        },
    route_type: route.route_type,
    school_name: route.school_name,
    company: company ? { id: company.id, name: company.name } : null,
    morning_time: route.morning_time,
    morning_arrival_time: route.morning_arrival_time,
    return_time: route.return_time,
    return_arrival_time: route.return_arrival_time,
    served_areas: route.servedAreaIds.map(areaRef),
    seats: route.seats,
    launch_minimum: route.launch_minimum,
    prices: route.prices,
    status: route.status,
    copied_from_route_id: route.copied_from_route_id,
    seats_taken: { this_month: route.taken, next_month: route.taken },
    seats_free: {
      this_month: route.seats - route.taken,
      next_month: route.seats - route.taken,
    },
    reserved: route.reserved,
    status_changes: statusChanges(route),
    created_at: route.created_at,
    updated_at: route.updated_at,
  };
}

const ROUTE_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,18}[A-Za-z0-9]$/;
const LOCAL_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const ROUTE_TYPES = ["public", "student", "corporate"];
const ROUTE_STATUSES = ["draft", "forming", "active", "paused"];

/**
 * A route body's fields, checked like the API's models (RouteCreate / RouteUpdate) before any
 * lookup: formats, limits, and on create the type's rules and the times' order.
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @param {{ partial: boolean }} options
 * @returns {Record<string, unknown> | undefined} normalised fields, or undefined after a 422
 */
function routeFields(response, body, { partial }) {
  const allowed = [
    "code",
    "corridor_id",
    "school_name",
    "company_id",
    "morning_time",
    "morning_arrival_time",
    "return_time",
    "return_arrival_time",
    "seats",
    "launch_minimum",
  ];
  if (!partial) allowed.push("route_type");
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) {
    validationProblem(response, `/${unknown}`, "unknown_field");
    return undefined;
  }
  if (partial) {
    const sent = Object.keys(body);
    if (sent.length === 0 || sent.some((key) => body[key] === null)) {
      validationProblem(response, "", "invalid");
      return undefined;
    }
  }
  /** @type {Record<string, unknown>} */
  const fields = {};
  const required = partial
    ? []
    : [
        "code",
        "corridor_id",
        "route_type",
        "morning_time",
        "morning_arrival_time",
        "return_time",
        "return_arrival_time",
        "seats",
      ];
  for (const field of required) {
    if (body[field] === undefined) {
      validationProblem(response, `/${field}`, "missing");
      return undefined;
    }
  }
  if (body.code !== undefined) {
    if (typeof body.code !== "string") {
      validationProblem(response, "/code", "invalid_type");
      return undefined;
    }
    const code = body.code.trim().toUpperCase();
    if (code.length < 2)
      return void validationProblem(response, "/code", "too_short");
    if (code.length > 20)
      return void validationProblem(response, "/code", "too_long");
    if (!ROUTE_CODE.test(code))
      return void validationProblem(response, "/code", "invalid_format");
    fields.code = code;
  }
  if (body.route_type !== undefined) {
    if (!ROUTE_TYPES.includes(String(body.route_type))) {
      return void validationProblem(response, "/route_type", "not_allowed");
    }
    fields.route_type = body.route_type;
  }
  for (const field of ["corridor_id", "company_id"]) {
    if (body[field] === undefined || body[field] === null) continue;
    if (typeof body[field] !== "string" || !UUID.test(String(body[field]))) {
      return void validationProblem(response, `/${field}`, "invalid_format");
    }
    fields[field] = body[field];
  }
  if (body.school_name !== undefined && body.school_name !== null) {
    const school = shortText(response, body.school_name, "school_name");
    if (school === undefined) return undefined;
    fields.school_name = school;
  }
  for (const field of [
    "morning_time",
    "morning_arrival_time",
    "return_time",
    "return_arrival_time",
  ]) {
    if (body[field] === undefined) continue;
    if (
      typeof body[field] !== "string" ||
      !LOCAL_TIME.test(String(body[field]))
    ) {
      return void validationProblem(response, `/${field}`, "invalid_format");
    }
    fields[field] = body[field];
  }
  for (const field of ["seats", "launch_minimum"]) {
    if (body[field] === undefined || body[field] === null) continue;
    if (!Number.isInteger(body[field])) {
      return void validationProblem(response, `/${field}`, "invalid_type");
    }
    const value = Number(body[field]);
    if (value < 1 || value > 60) {
      return void validationProblem(response, `/${field}`, "out_of_range");
    }
    fields[field] = value;
  }
  // Both in one body and in disagreement: the model refuses it.
  if (
    typeof fields.seats === "number" &&
    typeof fields.launch_minimum === "number" &&
    fields.launch_minimum > fields.seats
  ) {
    return void validationProblem(response, "", "invalid");
  }
  if (!partial) {
    const type = fields.route_type;
    const fits =
      (type === "student") === (fields.school_name !== undefined) &&
      (type === "corporate") === (fields.company_id !== undefined) &&
      (type === "corporate") === (fields.launch_minimum === undefined);
    if (
      !fits ||
      !timesInOrder([
        fields.morning_time,
        fields.morning_arrival_time,
        fields.return_time,
        fields.return_arrival_time,
      ])
    ) {
      return void validationProblem(response, "", "invalid");
    }
  }
  return fields;
}

/** Leave A, arrive at B, leave B, arrive at A: each after the one before (null: not set). */
function timesInOrder(/** @type {unknown[]} */ times) {
  const known = times.filter((time) => typeof time === "string");
  return known.every(
    (time, index) => index === 0 || String(known[index - 1]) < String(time),
  );
}

/**
 * A prices body (RoutePricesSet): round trip and one way required, Saturday optional (null: none),
 * whole birr 1–100,000.
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @returns {Schemas["Prices"] | undefined} undefined after a 422
 */
function pricesBody(response, body) {
  const unknown = Object.keys(body).find(
    (key) => !["round_trip", "one_way", "saturday"].includes(key),
  );
  if (unknown) {
    validationProblem(response, `/${unknown}`, "unknown_field");
    return undefined;
  }
  /** @type {Record<string, number | null>} */
  const prices = {};
  for (const field of ["round_trip", "one_way", "saturday"]) {
    const value = body[field];
    if (value === undefined || value === null) {
      if (field !== "saturday") {
        validationProblem(response, `/${field}`, "missing");
        return undefined;
      }
      prices[field] = null;
      continue;
    }
    if (!Number.isInteger(value)) {
      validationProblem(response, `/${field}`, "invalid_type");
      return undefined;
    }
    if (Number(value) < 1 || Number(value) > 100000) {
      validationProblem(response, `/${field}`, "out_of_range");
      return undefined;
    }
    prices[field] = Number(value);
  }
  return /** @type {Schemas["Prices"]} */ (prices);
}

/** @param {string} code @param {string} [exceptId] */
function routeCodeTaken(code, exceptId) {
  return routes.some((route) => route.id !== exceptId && route.code === code);
}

/** @param {string} id */
function liveCorridor(id) {
  return corridors.some((corridor) => corridor.id === id);
}

/** @param {string} id */
function activeCompany(id) {
  return companies.some((company) => company.id === id && company.is_active);
}

/**
 * A ShortText field, like the API: trimmed, same-looking spaces, 1–100 characters.
 * @param {ServerResponse} response
 * @param {unknown} value
 * @param {string} field
 * @returns {string | undefined}
 */
function shortText(response, value, field) {
  if (typeof value !== "string") {
    validationProblem(
      response,
      `/${field}`,
      value === undefined ? "missing" : "invalid_type",
    );
    return undefined;
  }
  const text = sameLooking(value);
  if (text === "") {
    validationProblem(response, `/${field}`, "too_short");
    return undefined;
  }
  if (text.length > 100) {
    validationProblem(response, `/${field}`, "too_long");
    return undefined;
  }
  return text;
}

const MOBILE = /^(?:(?:\+|00)?2510?|0)?([79][0-9]{8})$/;
const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * The company fields in a body, checked and normalised like the API's model.
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @param {{ partial: boolean }} options
 * @returns {Partial<FakeCompany> | undefined} undefined after a 422
 */
function companyFields(response, body, { partial }) {
  const allowed = [
    "name",
    "contact_name",
    "contact_phone",
    "contact_email",
    "notes",
  ];
  if (partial) allowed.push("is_active");
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) {
    validationProblem(response, `/${unknown}`, "unknown_field");
    return undefined;
  }
  if (partial) {
    const sent = Object.keys(body);
    if (sent.length === 0 || sent.some((key) => body[key] === null)) {
      validationProblem(response, "", "invalid");
      return undefined;
    }
  }
  /** @type {Partial<FakeCompany>} */
  const fields = {};
  for (const field of /** @type {const} */ (["name", "contact_name"])) {
    if (partial && body[field] === undefined) continue;
    const text = shortText(response, body[field], field);
    if (text === undefined) return undefined;
    fields[field] = text;
  }
  if (!partial || body.contact_phone !== undefined) {
    const phone = body.contact_phone;
    if (typeof phone !== "string") {
      validationProblem(
        response,
        "/contact_phone",
        phone === undefined ? "missing" : "invalid_type",
      );
      return undefined;
    }
    if (phone.trim().length > 20) {
      validationProblem(response, "/contact_phone", "too_long");
      return undefined;
    }
    const match = MOBILE.exec(phone.trim().replace(/[  \t().-]/g, ""));
    if (!match) {
      validationProblem(response, "/contact_phone", "invalid");
      return undefined;
    }
    fields.contact_phone = `+251${match[1]}`;
  }
  if (!partial || body.contact_email !== undefined) {
    const email = body.contact_email;
    if (typeof email !== "string") {
      validationProblem(
        response,
        "/contact_email",
        email === undefined ? "missing" : "invalid_type",
      );
      return undefined;
    }
    const trimmed = email.trim();
    if (trimmed.length > 320) {
      validationProblem(response, "/contact_email", "too_long");
      return undefined;
    }
    if (!EMAIL.test(trimmed)) {
      validationProblem(response, "/contact_email", "invalid_format");
      return undefined;
    }
    fields.contact_email = trimmed.toLowerCase();
  }
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string") {
      validationProblem(response, "/notes", "invalid_type");
      return undefined;
    }
    const notes = body.notes.trim().replace(/\r\n?/g, "\n");
    if (notes.length > 1000) {
      validationProblem(response, "/notes", "too_long");
      return undefined;
    }
    fields.notes = notes === "" ? null : notes;
  }
  if (partial && body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      validationProblem(response, "/is_active", "invalid_type");
      return undefined;
    }
    fields.is_active = body.is_active;
  }
  return fields;
}

/** @param {string} name @param {string} [exceptId] */
function companyNameTaken(name, exceptId) {
  return companies.some(
    (company) =>
      company.id !== exceptId &&
      company.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listCompanies(url, response) {
  const q = url.searchParams.get("q")?.trim() || null;
  if (q !== null && q.length > 100) {
    return validationProblem(response, "/q", "too_long", "query");
  }
  const active = url.searchParams.get("is_active");
  if (active !== null && !["true", "false"].includes(active)) {
    return validationProblem(response, "/is_active", "invalid_type", "query");
  }
  const limit = Number(url.searchParams.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return validationProblem(response, "/limit", "out_of_range", "query");
  }
  const cursor = url.searchParams.get("cursor");
  const offset =
    cursor === null ? 0 : Number(Buffer.from(cursor, "base64url").toString());
  if (cursor === "" || !Number.isInteger(offset) || offset < 0) {
    return problem(response, 422, "INVALID_CURSOR");
  }
  const matching = companies
    .filter(
      (company) =>
        (q === null ||
          company.name.toLowerCase().startsWith(q.toLowerCase())) &&
        (active === null || company.is_active === (active === "true")),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  /** @type {Schemas["CompanyPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listRoutes(url, response) {
  const q = url.searchParams.get("q")?.trim() || null;
  if (q !== null && q.length > 20) {
    return validationProblem(response, "/q", "too_long", "query");
  }
  const type = url.searchParams.get("route_type");
  if (type !== null && !ROUTE_TYPES.includes(type)) {
    return validationProblem(response, "/route_type", "not_allowed", "query");
  }
  const status = url.searchParams.get("status");
  if (status !== null && !ROUTE_STATUSES.includes(status)) {
    return validationProblem(response, "/status", "not_allowed", "query");
  }
  /** @type {Record<string, string | null>} */
  const ids = {};
  for (const name of ["corridor_id", "company_id"]) {
    const value = url.searchParams.get(name);
    if (value !== null && !UUID.test(value)) {
      return validationProblem(response, `/${name}`, "invalid_format", "query");
    }
    ids[name] = value;
  }
  const limit = Number(url.searchParams.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return validationProblem(response, "/limit", "out_of_range", "query");
  }
  const cursor = url.searchParams.get("cursor");
  const offset =
    cursor === null ? 0 : Number(Buffer.from(cursor, "base64url").toString());
  if (cursor === "" || !Number.isInteger(offset) || offset < 0) {
    return problem(response, 422, "INVALID_CURSOR");
  }
  const matching = routes
    .filter(
      (route) =>
        (q === null || route.code.startsWith(q.toUpperCase())) &&
        (type === null || route.route_type === type) &&
        (status === null || route.status === status) &&
        (ids.corridor_id === null || route.corridorId === ids.corridor_id) &&
        (ids.company_id === null || route.companyId === ids.company_id),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  /** @type {Schemas["RoutePage"]} */
  const page = {
    items: matching.slice(offset, offset + limit).map(routeRead),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

/** @type {Map<string, { route: FakeRoute; fingerprint: string }>} */
const routeKeys = new Map();

const api = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "OPTIONS") return send(response, 204);

  // The API verifies the token itself (signature and expiry), not the session.
  const claims = verifyAccessToken(bearer(request));
  const user = users.find((candidate) => candidate.email === claims?.email);
  if (!user) return problem(response, 401, "UNAUTHENTICATED");

  if (request.method === "GET" && url.pathname === "/v1/staff/me") {
    if (user.staff === "forbidden") return problem(response, 403, "FORBIDDEN");
    /** @type {Schemas["StaffMe"]} */
    const body = user.staff;
    return send(response, 200, body);
  }
  if (user.staff === "forbidden") return problem(response, 403, "FORBIDDEN");
  const isAdmin = user.staff.role === "admin";

  if (url.pathname === "/v1/areas") {
    if (request.method === "GET") return listAreas(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = await readJson(request);
      const fingerprint = JSON.stringify(body);
      // FastAPI validates the body before the handler looks at the key.
      const name = validAreaName(response, body.name);
      if (name === undefined) return;
      const replay = areaKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, areaRead(replay.area), {
          "Idempotent-Replayed": "true",
        });
      }
      if (areaNameTaken(name)) return problem(response, 409, "AREA_NAME_TAKEN");
      const now = new Date().toISOString();
      /** @type {FakeArea} */
      const area = { id: randomUUID(), name, created_at: now, updated_at: now };
      areas.push(area);
      areaKeys.set(`${user.email}|${key}`, { area, fingerprint });
      return send(response, 201, areaRead(area));
    }
  }

  const areaMatch = /^\/v1\/areas\/([^/]+)$/.exec(url.pathname);
  if (areaMatch && !UUID.test(areaMatch[1] ?? "")) {
    return validationProblem(response, "/area_id", "invalid_format", "path");
  }
  if (areaMatch) {
    // Admin-only, so the role is checked before the area is looked up.
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    const area = areas.find((candidate) => candidate.id === areaMatch[1]);
    if (!area) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET") return send(response, 200, areaRead(area));
    if (request.method === "PATCH") {
      const body = await readJson(request);
      const name = validAreaName(response, body.name);
      if (name === undefined) return;
      if (areaNameTaken(name, area.id)) {
        return problem(response, 409, "AREA_NAME_TAKEN");
      }
      area.name = name;
      area.updated_at = new Date().toISOString();
      return send(response, 200, areaRead(area));
    }
    if (request.method === "DELETE") {
      // In use while a corridor uses it or a route serves it (route requests aren't modelled).
      const inUse =
        corridors.some(
          (corridor) =>
            corridor.originId === area.id || corridor.destinationId === area.id,
        ) || routes.some((route) => route.servedAreaIds.includes(area.id));
      if (inUse) return problem(response, 409, "AREA_IN_USE");
      areas.splice(areas.indexOf(area), 1);
      return send(response, 204);
    }
  }

  if (url.pathname === "/v1/corridors") {
    if (request.method === "GET") return listCorridors(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = await readJson(request);
      const fingerprint = JSON.stringify(body);
      // FastAPI validates the body before the handler looks at the key.
      if (!corridorBodyValid(response, body, { partial: false })) return;
      const replay = corridorKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, corridorRead(replay.corridor), {
          "Idempotent-Replayed": "true",
        });
      }
      const originId = String(body.origin_area_id);
      const destinationId = String(body.destination_area_id);
      if (!areaExists(response, originId, "origin_area_id")) return;
      if (!areaExists(response, destinationId, "destination_area_id")) return;
      if (pairTaken(originId, destinationId)) {
        return problem(response, 409, "CORRIDOR_EXISTS");
      }
      const now = new Date().toISOString();
      /** @type {FakeCorridor} */
      const corridor = {
        id: randomUUID(),
        originId,
        destinationId,
        created_at: now,
        updated_at: now,
      };
      corridors.push(corridor);
      corridorKeys.set(`${user.email}|${key}`, { corridor, fingerprint });
      return send(response, 201, corridorRead(corridor));
    }
  }

  const corridorMatch = /^\/v1\/corridors\/([^/]+)$/.exec(url.pathname);
  if (corridorMatch && !UUID.test(corridorMatch[1] ?? "")) {
    return validationProblem(
      response,
      "/corridor_id",
      "invalid_format",
      "path",
    );
  }
  if (corridorMatch) {
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    // The body is validated before the corridor is looked up, as FastAPI does.
    const body = request.method === "PATCH" ? await readJson(request) : {};
    if (
      request.method === "PATCH" &&
      !corridorBodyValid(response, body, { partial: true })
    ) {
      return;
    }
    const corridor = corridors.find(
      (candidate) => candidate.id === corridorMatch[1],
    );
    if (!corridor) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET") {
      return send(response, 200, corridorRead(corridor));
    }
    if (request.method === "PATCH") {
      // Like the service: only an end that changes is looked up.
      const nextOrigin =
        typeof body.origin_area_id === "string"
          ? body.origin_area_id
          : corridor.originId;
      const nextDestination =
        typeof body.destination_area_id === "string"
          ? body.destination_area_id
          : corridor.destinationId;
      if (
        nextOrigin !== corridor.originId &&
        !areaExists(response, nextOrigin, "origin_area_id")
      ) {
        return;
      }
      if (
        nextDestination !== corridor.destinationId &&
        !areaExists(response, nextDestination, "destination_area_id")
      ) {
        return;
      }
      if (nextOrigin === nextDestination) {
        return validationProblem(response, "", "invalid");
      }
      const moved =
        nextOrigin !== corridor.originId ||
        nextDestination !== corridor.destinationId;
      if (moved && corridorUsedByRoute(corridor.id)) {
        return problem(response, 409, "CORRIDOR_IN_USE");
      }
      if (pairTaken(nextOrigin, nextDestination, corridor.id)) {
        return problem(response, 409, "CORRIDOR_EXISTS");
      }
      if (moved) {
        corridor.originId = nextOrigin;
        corridor.destinationId = nextDestination;
        corridor.updated_at = new Date().toISOString();
      }
      return send(response, 200, corridorRead(corridor));
    }
    if (request.method === "DELETE") {
      if (corridorUsedByRoute(corridor.id)) {
        return problem(response, 409, "CORRIDOR_IN_USE");
      }
      corridors.splice(corridors.indexOf(corridor), 1);
      return send(response, 204);
    }
  }

  if (url.pathname === "/v1/routes") {
    if (request.method === "GET") return listRoutes(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = await readJson(request);
      const fingerprint = JSON.stringify(body);
      // FastAPI validates the body before the handler looks at the key.
      const fields = routeFields(response, body, { partial: false });
      if (!fields) return;
      const replay = routeKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, routeRead(replay.route), {
          "Idempotent-Replayed": "true",
        });
      }
      // Places first: one that doesn't exist (or a company that isn't active) is a 422.
      if (!liveCorridor(String(fields.corridor_id))) {
        return validationProblem(response, "/corridor_id", "invalid");
      }
      if (
        fields.company_id !== undefined &&
        !activeCompany(String(fields.company_id))
      ) {
        return validationProblem(response, "/company_id", "invalid");
      }
      if (routeCodeTaken(String(fields.code))) {
        return problem(response, 409, "ROUTE_CODE_TAKEN");
      }
      const now = new Date().toISOString();
      const corporate = fields.route_type === "corporate";
      /** @type {FakeRoute} */
      const route = {
        id: randomUUID(),
        code: String(fields.code),
        corridorId: String(fields.corridor_id),
        route_type: /** @type {Schemas["RouteType"]} */ (fields.route_type),
        school_name: /** @type {string | null} */ (fields.school_name ?? null),
        companyId: /** @type {string | null} */ (fields.company_id ?? null),
        morning_time: String(fields.morning_time),
        morning_arrival_time: String(fields.morning_arrival_time),
        return_time: String(fields.return_time),
        return_arrival_time: String(fields.return_arrival_time),
        servedAreaIds: [],
        seats: Number(fields.seats),
        launch_minimum: corporate ? null : Number(fields.launch_minimum),
        prices: corporate
          ? null
          : { round_trip: null, one_way: null, saturday: null },
        status: "draft",
        copied_from_route_id: null,
        taken: 0,
        reserved: 0,
        hasRiders: false,
        hasRequests: false,
        created_at: now,
        updated_at: now,
      };
      routes.push(route);
      routeKeys.set(`${user.email}|${key}`, { route, fingerprint });
      return send(response, 201, routeRead(route));
    }
  }

  // Add a van (GZ-028): a copy with its own code, seats and (individual routes) launch minimum.
  const copiesMatch = /^\/v1\/routes\/([^/]+)\/copies$/.exec(url.pathname);
  if (copiesMatch && request.method === "POST") {
    if (!UUID.test(copiesMatch[1] ?? "")) {
      return validationProblem(response, "/route_id", "invalid_format", "path");
    }
    const key = idempotencyKey(request, response);
    if (key === undefined) return;
    const body = (await readJson(request)) ?? {};
    // The model's checks: code, seats, a launch minimum within the seats.
    const unknown = Object.keys(body).find(
      (field) => !["code", "seats", "launch_minimum"].includes(field),
    );
    if (unknown)
      return validationProblem(response, `/${unknown}`, "unknown_field");
    for (const field of ["code", "seats"]) {
      if (body[field] === undefined) {
        return validationProblem(response, `/${field}`, "missing");
      }
    }
    if (typeof body.code !== "string") {
      return validationProblem(response, "/code", "invalid_type");
    }
    const code = body.code.trim().toUpperCase();
    if (code.length < 2)
      return validationProblem(response, "/code", "too_short");
    if (code.length > 20)
      return validationProblem(response, "/code", "too_long");
    if (!ROUTE_CODE.test(code)) {
      return validationProblem(response, "/code", "invalid_format");
    }
    for (const field of ["seats", "launch_minimum"]) {
      const value = body[field];
      if (value === undefined || value === null) continue;
      if (!Number.isInteger(value)) {
        return validationProblem(response, `/${field}`, "invalid_type");
      }
      if (Number(value) < 1 || Number(value) > 60) {
        return validationProblem(response, `/${field}`, "out_of_range");
      }
    }
    const seats = Number(body.seats);
    const minimum =
      body.launch_minimum === undefined || body.launch_minimum === null
        ? null
        : Number(body.launch_minimum);
    if (minimum !== null && minimum > seats) {
      return validationProblem(response, "", "invalid");
    }
    const fingerprint = `${copiesMatch[1]}|${JSON.stringify(body)}`;
    const replay = routeKeys.get(`${user.email}|${key}`);
    if (replay) {
      if (replay.fingerprint !== fingerprint) {
        return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
      }
      return send(response, 201, routeRead(replay.route), {
        "Idempotent-Replayed": "true",
      });
    }
    const original = routes.find(
      (candidate) => candidate.id === copiesMatch[1],
    );
    if (!original) return problem(response, 404, "NOT_FOUND");
    const corporate = original.route_type === "corporate";
    if ((minimum === null) !== corporate) {
      return validationProblem(response, "/launch_minimum", "invalid");
    }
    if (corporate && companyInactive(original)) {
      return problem(response, 409, "ROUTE_NOT_READY");
    }
    if (routeCodeTaken(code)) return problem(response, 409, "ROUTE_CODE_TAKEN");
    const priced =
      original.prices?.round_trip != null && original.prices?.one_way != null;
    const now = new Date().toISOString();
    /** @type {FakeRoute} */
    const van = {
      ...original,
      id: randomUUID(),
      code,
      seats,
      launch_minimum: minimum,
      prices: original.prices ? { ...original.prices } : null,
      servedAreaIds: [...original.servedAreaIds],
      status: priced && !corporate ? "forming" : "draft",
      copied_from_route_id: original.id,
      taken: 0,
      reserved: 0,
      laterReserved: undefined,
      hasRiders: false,
      hasRequests: false,
      created_at: now,
      updated_at: now,
    };
    routes.push(van);
    routeKeys.set(`${user.email}|${key}`, { route: van, fingerprint });
    return send(response, 201, routeRead(van));
  }

  // Status (GZ-024): staff and admins; the body's format first, then the route, then the moves.
  const statusMatch = /^\/v1\/routes\/([^/]+)\/status$/.exec(url.pathname);
  if (statusMatch && request.method === "PUT") {
    if (!UUID.test(statusMatch[1] ?? "")) {
      return validationProblem(response, "/route_id", "invalid_format", "path");
    }
    const body = (await readJson(request)) ?? {};
    const unknown = Object.keys(body).find(
      (key) => !["status", "launch_date"].includes(key),
    );
    if (unknown)
      return validationProblem(response, `/${unknown}`, "unknown_field");
    if (body.status === undefined) {
      return validationProblem(response, "/status", "missing");
    }
    if (!ROUTE_STATUSES.includes(String(body.status))) {
      return validationProblem(response, "/status", "not_allowed");
    }
    const launchDate = body.launch_date ?? null;
    if (launchDate !== null) {
      if (
        typeof launchDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(launchDate)
      ) {
        return validationProblem(response, "/launch_date", "invalid_format");
      }
      // The model's own check: only a launch (status active) names a day, the 1st.
      if (body.status !== "active" || !launchDate.endsWith("-01")) {
        return validationProblem(response, "/launch_date", "invalid");
      }
    }
    const route = routes.find((candidate) => candidate.id === statusMatch[1]);
    if (!route) return problem(response, 404, "NOT_FOUND");
    const to = /** @type {FakeRoute["status"]} */ (body.status);
    if (to === route.status) return send(response, 200, routeRead(route));
    if (
      !movesOf(route).some(
        ([from, next]) => from === route.status && next === to,
      )
    ) {
      return problem(response, 409, "INVALID_STATUS_CHANGE");
    }
    const launching = route.status === "forming" && to === "active";
    if (launching !== (launchDate !== null)) {
      return validationProblem(response, "/launch_date", "invalid");
    }
    if (launchDate !== null && !launchDays().includes(launchDate)) {
      return validationProblem(response, "/launch_date", "invalid");
    }
    if (
      to === "forming" &&
      (route.prices?.round_trip == null || route.prices?.one_way == null)
    ) {
      return problem(response, 409, "ROUTE_NOT_READY");
    }
    if (route.status === "forming" && to === "draft" && route.hasRiders) {
      return problem(response, 409, "ROUTE_HAS_RIDERS");
    }
    if (
      route.route_type === "corporate" &&
      to === "active" &&
      companyInactive(route)
    ) {
      return problem(response, 409, "ROUTE_NOT_READY");
    }
    const reservedThen =
      launchDate !== null &&
      launchDate !== nextLaunchDay() &&
      route.laterReserved !== undefined
        ? route.laterReserved
        : route.reserved;
    if (launching && reservedThen < (route.launch_minimum ?? 0)) {
      return problem(response, 409, "NOT_ENOUGH_RIDERS");
    }
    if (launching) {
      route.taken += route.reserved;
      route.reserved = 0;
    }
    route.status = to;
    route.updated_at = new Date().toISOString();
    return send(response, 200, routeRead(route));
  }

  const monthsMatch = /^\/v1\/routes\/([^/]+)\/launch-months$/.exec(
    url.pathname,
  );
  if (monthsMatch && request.method === "GET") {
    if (!UUID.test(monthsMatch[1] ?? "")) {
      return validationProblem(response, "/route_id", "invalid_format", "path");
    }
    const route = routes.find((candidate) => candidate.id === monthsMatch[1]);
    if (!route) return problem(response, 404, "NOT_FOUND");
    // The earliest month counts `reserved`; later ones `laterReserved` when a route has one.
    /** @type {Schemas["RouteLaunchMonths"]} */
    const months = {
      status: route.status,
      launch_minimum: route.launch_minimum,
      months: launchDays().map((day, index) => {
        const reserved =
          index > 0 && route.laterReserved !== undefined
            ? route.laterReserved
            : route.reserved;
        return {
          launch_date: day,
          reserved,
          ready:
            route.status === "forming" &&
            reserved >= (route.launch_minimum ?? 0),
        };
      }),
    };
    return send(response, 200, months);
  }

  // Areas served (GZ-023): staff and admins; the whole ordered list at once.
  const areasMatch = /^\/v1\/routes\/([^/]+)\/areas$/.exec(url.pathname);
  if (areasMatch && request.method === "PUT") {
    if (!UUID.test(areasMatch[1] ?? "")) {
      return validationProblem(response, "/route_id", "invalid_format", "path");
    }
    // The body's format first (FastAPI), then the route, then the service's checks.
    const body = (await readJson(request)) ?? {};
    if (typeof body !== "object" || Array.isArray(body)) {
      return validationProblem(response, "", "invalid_type");
    }
    const unknown = Object.keys(body).find((key) => key !== "area_ids");
    if (unknown) {
      return validationProblem(response, `/${unknown}`, "unknown_field");
    }
    const ids = body.area_ids;
    if (ids === undefined) {
      return validationProblem(response, "/area_ids", "missing");
    }
    if (!Array.isArray(ids)) {
      return validationProblem(response, "/area_ids", "invalid_type");
    }
    if (ids.length > 20) {
      return validationProblem(response, "/area_ids", "too_long");
    }
    const bad = ids.findIndex((id) => typeof id !== "string" || !UUID.test(id));
    if (bad !== -1) {
      return validationProblem(response, `/area_ids/${bad}`, "invalid_format");
    }
    const route = routes.find((candidate) => candidate.id === areasMatch[1]);
    if (!route) return problem(response, 404, "NOT_FOUND");
    const corridor = corridors.find((c) => c.id === route.corridorId);
    const ends = [corridor?.originId, corridor?.destinationId];
    // Like the service: each once and not A or B, then the same list changes nothing, then
    // every area must still exist.
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => ends.includes(id))
    ) {
      return validationProblem(response, "/area_ids", "invalid");
    }
    const same =
      ids.length === route.servedAreaIds.length &&
      ids.every((id, index) => id === route.servedAreaIds[index]);
    if (same) return send(response, 200, routeRead(route));
    if (ids.some((id) => !areas.some((area) => area.id === id))) {
      return validationProblem(response, "/area_ids", "invalid");
    }
    route.servedAreaIds = [...ids];
    route.updated_at = new Date().toISOString();
    return send(response, 200, routeRead(route));
  }

  // Prices (GZ-022): admins only; the body is checked before the route is looked up.
  const pricesMatch = /^\/v1\/routes\/([^/]+)\/prices$/.exec(url.pathname);
  if (pricesMatch && request.method === "PUT") {
    // The admin dependency runs before the path and body are validated.
    if (!isAdmin) return problem(response, 403, "FORBIDDEN");
    if (!UUID.test(pricesMatch[1] ?? "")) {
      return validationProblem(response, "/route_id", "invalid_format", "path");
    }
    const prices = pricesBody(response, await readJson(request));
    if (!prices) return;
    const route = routes.find((candidate) => candidate.id === pricesMatch[1]);
    if (!route) return problem(response, 404, "NOT_FOUND");
    if (route.route_type === "corporate") {
      return problem(response, 409, "ROUTE_HAS_NO_PRICES");
    }
    if (prices.saturday !== null && route.route_type !== "public") {
      return validationProblem(response, "/saturday", "invalid");
    }
    route.prices = prices;
    route.updated_at = new Date().toISOString();
    return send(response, 200, routeRead(route));
  }

  const routeMatch = /^\/v1\/routes\/([^/]+)$/.exec(url.pathname);
  if (routeMatch && !UUID.test(routeMatch[1] ?? "")) {
    return validationProblem(response, "/route_id", "invalid_format", "path");
  }
  if (routeMatch) {
    // Delete is admin-only (a dependency, before anything else).
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    // The body is validated before the route is looked up, as FastAPI does.
    const body = request.method === "PATCH" ? await readJson(request) : {};
    const fields =
      request.method === "PATCH"
        ? routeFields(response, body, { partial: true })
        : {};
    if (!fields) return;
    const route = routes.find((candidate) => candidate.id === routeMatch[1]);
    if (!route) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET") return send(response, 200, routeRead(route));
    if (request.method === "DELETE") {
      if (route.hasRiders) return problem(response, 409, "ROUTE_HAS_RIDERS");
      if (route.hasRequests)
        return problem(response, 409, "ROUTE_HAS_REQUESTS");
      routes.splice(routes.indexOf(route), 1);
      return send(response, 204);
    }
    if (request.method === "PATCH") {
      // Like the service, in its order.
      const notForType = [
        ["school_name", route.route_type !== "student"],
        ["company_id", route.route_type !== "corporate"],
        ["launch_minimum", route.route_type === "corporate"],
      ].find(([field, refused]) => refused && String(field) in fields);
      if (notForType) {
        return validationProblem(response, `/${notForType[0]}`, "invalid");
      }
      const times = /** @type {(string | null)[]} */ ([
        fields.morning_time ?? route.morning_time,
        fields.morning_arrival_time ?? route.morning_arrival_time,
        fields.return_time ?? route.return_time,
        fields.return_arrival_time ?? route.return_arrival_time,
      ]);
      if (!timesInOrder(times))
        return validationProblem(response, "", "invalid");
      if (times[1] === null && times[3] !== null) {
        return validationProblem(response, "/morning_arrival_time", "invalid");
      }
      if (times[3] === null && times[1] !== null) {
        return validationProblem(response, "/return_arrival_time", "invalid");
      }
      const newCorridor =
        fields.corridor_id !== undefined &&
        fields.corridor_id !== route.corridorId;
      if (newCorridor) {
        if (
          route.servedAreaIds.length > 0 ||
          !liveCorridor(String(fields.corridor_id))
        ) {
          return validationProblem(response, "/corridor_id", "invalid");
        }
      }
      const newCompany =
        fields.company_id !== undefined &&
        fields.company_id !== route.companyId;
      if (newCompany && !activeCompany(String(fields.company_id))) {
        return validationProblem(response, "/company_id", "invalid");
      }
      const seats = /** @type {number} */ (fields.seats ?? route.seats);
      const minimum = /** @type {number | null} */ (
        fields.launch_minimum ?? route.launch_minimum
      );
      if (minimum !== null && minimum > seats) {
        return problem(response, 409, "SEATS_BELOW_LAUNCH_MINIMUM");
      }
      if (seats < route.seats && seats < route.taken) {
        return problem(response, 409, "SEATS_BELOW_TAKEN");
      }
      if (
        fields.code !== undefined &&
        fields.code !== route.code &&
        routeCodeTaken(String(fields.code), route.id)
      ) {
        return problem(response, 409, "ROUTE_CODE_TAKEN");
      }
      const newSchool =
        fields.school_name !== undefined &&
        (route.school_name === null ||
          String(fields.school_name).toLowerCase() !==
            route.school_name.toLowerCase());
      const relocates = newCorridor || newSchool;
      if ((relocates || newCompany) && route.hasRiders) {
        return problem(response, 409, "ROUTE_HAS_RIDERS");
      }
      if (relocates && route.hasRequests) {
        return problem(response, 409, "ROUTE_HAS_REQUESTS");
      }
      const priced =
        route.prices !== null &&
        Object.values(route.prices).some((price) => price !== null);
      if (relocates && priced) {
        return problem(response, 409, "ROUTE_HAS_PRICES");
      }
      Object.assign(route, {
        code: fields.code ?? route.code,
        corridorId: fields.corridor_id ?? route.corridorId,
        companyId: fields.company_id ?? route.companyId,
        school_name: fields.school_name ?? route.school_name,
        morning_time: times[0],
        morning_arrival_time: times[1],
        return_time: times[2],
        return_arrival_time: times[3],
        seats,
        launch_minimum: minimum,
        updated_at: new Date().toISOString(),
      });
      return send(response, 200, routeRead(route));
    }
  }

  if (url.pathname === "/v1/companies") {
    if (request.method === "GET") return listCompanies(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = await readJson(request);
      const fingerprint = JSON.stringify(body);
      // FastAPI validates the body before the handler looks at the key.
      const fields = companyFields(response, body, { partial: false });
      if (!fields) return;
      const replay = companyKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, replay.company, {
          "Idempotent-Replayed": "true",
        });
      }
      if (companyNameTaken(String(fields.name))) {
        return problem(response, 409, "COMPANY_NAME_TAKEN");
      }
      const now = new Date().toISOString();
      /** @type {FakeCompany} */
      const company = {
        id: randomUUID(),
        name: String(fields.name),
        contact_name: String(fields.contact_name),
        contact_phone: String(fields.contact_phone),
        contact_email: String(fields.contact_email),
        billing: "postpaid",
        notes: fields.notes ?? null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      companies.push(company);
      companyKeys.set(`${user.email}|${key}`, { company, fingerprint });
      return send(response, 201, company);
    }
  }

  const companyMatch = /^\/v1\/companies\/([^/]+)$/.exec(url.pathname);
  if (companyMatch && !UUID.test(companyMatch[1] ?? "")) {
    return validationProblem(response, "/company_id", "invalid_format", "path");
  }
  if (companyMatch) {
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    // The body is validated before the company is looked up, as FastAPI does.
    const body = request.method === "PATCH" ? await readJson(request) : {};
    const fields =
      request.method === "PATCH"
        ? companyFields(response, body, { partial: true })
        : {};
    if (!fields) return;
    const company = companies.find(
      (candidate) => candidate.id === companyMatch[1],
    );
    if (!company) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET") return send(response, 200, company);
    if (request.method === "PATCH") {
      const runsARoute = routes.some(
        (route) =>
          route.companyId === company.id &&
          (route.status === "active" || route.status === "paused"),
      );
      if (company.is_active && fields.is_active === false && runsARoute) {
        return problem(response, 409, "COMPANY_IN_USE");
      }
      if (
        fields.name !== undefined &&
        companyNameTaken(fields.name, company.id)
      ) {
        return problem(response, 409, "COMPANY_NAME_TAKEN");
      }
      Object.assign(company, fields, { updated_at: new Date().toISOString() });
      return send(response, 200, company);
    }
    if (request.method === "DELETE") {
      if (routes.some((route) => route.companyId === company.id)) {
        return problem(response, 409, "COMPANY_IN_USE");
      }
      companies.splice(companies.indexOf(company), 1);
      return send(response, 204);
    }
  }

  problem(response, 404, "NOT_FOUND");
});

// No host: listens on IPv6 and IPv4, so both "localhost" and 127.0.0.1 reach it.
supabase.listen(FAKE_SUPABASE_PORT);
api.listen(FAKE_API_PORT);
process.stdout.write(
  `e2e stand-ins: Supabase Auth on :${FAKE_SUPABASE_PORT}, API on :${FAKE_API_PORT}\n`,
);
