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
 *   updated_at: string; usedByRoute?: boolean }} FakeCorridor
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
    // A live route runs on it: changing its ends or deleting it is refused (CORRIDOR_IN_USE).
    usedByRoute: origin === "Bole" && destination === "Piassa",
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

/** @param {string} origin @param {string} destination */
function corridorRef(origin, destination) {
  const corridor = corridors.find(
    (candidate) =>
      candidate.originId === areaId(origin) &&
      candidate.destinationId === areaId(destination),
  );
  if (!corridor)
    throw new Error(`no seeded corridor ${origin} → ${destination}`);
  return {
    id: corridor.id,
    origin_area: areaRef(corridor.originId),
    destination_area: areaRef(corridor.destinationId),
  };
}

// Corporate routes (only what company details show is modelled; routes get their own endpoints
// with GZW-021). Addis Brewery runs one (can't be deactivated or deleted); Ethio Ceramics has a
// draft one (can be deactivated, not deleted).
/** @type {(Schemas["RouteRead"] & { companyId: string })[]} */
const routes = [
  ["R-21", "Addis Brewery", "Bole", "Piassa", "active"],
  ["R-22", "Ethio Ceramics", "Megenagna", "Mexico", "draft"],
].map(([code, company, origin, destination, status], index) => {
  const at = new Date(Date.UTC(2026, 9, 4, 6, index)).toISOString();
  const id = companyId(String(company));
  return {
    companyId: id,
    id: `00000000-0000-4000-d000-${String(index + 1).padStart(12, "0")}`,
    code: String(code),
    corridor: corridorRef(String(origin), String(destination)),
    route_type: /** @type {const} */ ("corporate"),
    school_name: null,
    company: { id, name: String(company) },
    morning_time: "06:30",
    morning_arrival_time: "07:15",
    return_time: "17:30",
    return_arrival_time: "18:15",
    served_areas: [],
    seats: 14,
    launch_minimum: null,
    prices: null,
    status: /** @type {Schemas["RouteStatus"]} */ (status),
    copied_from_route_id: null,
    seats_taken: { this_month: 9, next_month: 9 },
    seats_free: { this_month: 5, next_month: 5 },
    reserved: 0,
    status_changes: [],
    created_at: at,
    updated_at: at,
  };
});

/** @param {Schemas["RouteRead"] & { companyId: string }} route @returns {Schemas["RouteRead"]} */
function routeRead({ companyId: _companyId, ...route }) {
  // Names follow renames, like the API's joins.
  const company = companies.find((candidate) => candidate.id === _companyId);
  return {
    ...route,
    company: company ? { id: company.id, name: company.name } : route.company,
  };
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
 * Routes, filtered by company only (what company details need).
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listRoutes(url, response) {
  const company = url.searchParams.get("company_id");
  if (company !== null && !UUID.test(company)) {
    return validationProblem(
      response,
      "/company_id",
      "invalid_format",
      "query",
    );
  }
  const items = routes
    .filter((route) => company === null || route.companyId === company)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(routeRead);
  /** @type {Schemas["RoutePage"]} */
  const page = { items, next_cursor: null };
  send(response, 200, page);
}

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
      const replay = areaKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, areaRead(replay.area), {
          "Idempotent-Replayed": "true",
        });
      }
      const name = validAreaName(response, body.name);
      if (name === undefined) return;
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
      // In use while a corridor uses it (routes and route requests aren't modelled here).
      const inUse = corridors.some(
        (corridor) =>
          corridor.originId === area.id || corridor.destinationId === area.id,
      );
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
      const replay = corridorKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, corridorRead(replay.corridor), {
          "Idempotent-Replayed": "true",
        });
      }
      if (!corridorBodyValid(response, body, { partial: false })) return;
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
      if (moved && corridor.usedByRoute) {
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
      if (corridor.usedByRoute) {
        return problem(response, 409, "CORRIDOR_IN_USE");
      }
      corridors.splice(corridors.indexOf(corridor), 1);
      return send(response, 204);
    }
  }

  if (request.method === "GET" && url.pathname === "/v1/routes") {
    return listRoutes(url, response);
  }

  if (url.pathname === "/v1/companies") {
    if (request.method === "GET") return listCompanies(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = await readJson(request);
      const fingerprint = JSON.stringify(body);
      const replay = companyKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, replay.company, {
          "Idempotent-Replayed": "true",
        });
      }
      const fields = companyFields(response, body, { partial: false });
      if (!fields) return;
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
