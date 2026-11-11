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

// Email links (GZW-012), like Supabase Auth: an invite or recovery link carries a token hash that
// works once. The stand-in sends no email; tests ask for the link a real email would hold.
/** @type {Map<string, { user: TestUser, type: "invite" | "recovery", used: boolean }>} */
const emailLinks = new Map();
/** The recovery link last "emailed" to each address. @type {Map<string, string>} */
const lastRecovery = new Map();
/** When each address was last emailed: like Supabase, a real account gets one a minute. */
const lastRecoveryAt = new Map();
const RECOVERY_GAP_MS = 60_000;
/** Supabase's minimum password length, as set for the project (owner decision: 12). */
const MIN_PASSWORD_LENGTH = 12;

/** @param {TestUser} user @param {"invite" | "recovery"} type @returns {string} the token hash */
function emailLink(user, type) {
  const tokenHash = `${type}-${randomUUID()}`;
  emailLinks.set(tokenHash, { user, type, used: false });
  return tokenHash;
}

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

  // Opening an email link: the token hash works once, for its own type, and signs the person in.
  if (request.method === "POST" && url.pathname === "/auth/v1/verify") {
    const body = await readJson(request);
    const link = emailLinks.get(String(body.token_hash ?? ""));
    if (!link || link.used || link.type !== body.type) {
      return authError(
        response,
        403,
        "otp_expired",
        "Email link is invalid or has expired",
      );
    }
    link.used = true;
    return send(response, 200, issueTokens(link.user));
  }

  // "Forgot your password?": always 200, whether or not the email has an account.
  if (request.method === "POST" && url.pathname === "/auth/v1/recover") {
    const body = await readJson(request);
    const email = String(body.email ?? "").toLowerCase();
    const user = users.find((candidate) => candidate.email === email);
    if (
      user &&
      Date.now() - (lastRecoveryAt.get(email) ?? 0) < RECOVERY_GAP_MS
    ) {
      // Only for a real account, as Supabase does: the portal must not let this show.
      return authError(
        response,
        429,
        "over_email_send_rate_limit",
        "For security purposes, you can only request this after 60 seconds.",
      );
    }
    if (user) {
      lastRecovery.set(email, emailLink(user, "recovery"));
      lastRecoveryAt.set(email, Date.now());
    }
    return send(response, 200, {});
  }

  // Setting a password: needs a session; the project's minimum length; not the current one.
  if (request.method === "PUT" && url.pathname === "/auth/v1/user") {
    const session = activeSession(request);
    if (!session) return authError(response, 403, "bad_jwt", "invalid JWT");
    const body = await readJson(request);
    const password = String(body.password ?? "");
    if (Buffer.byteLength(password) > 72) {
      return authError(
        response,
        422,
        "validation_failed",
        "Password cannot be longer than 72 characters",
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return send(
        response,
        422,
        {
          code: "weak_password",
          msg: `Password should be at least ${MIN_PASSWORD_LENGTH} characters.`,
          weak_password: { reasons: ["length"] },
        },
        { "X-Supabase-Api-Version": "2024-01-01" },
      );
    }
    if (password === session.user.password) {
      return authError(
        response,
        422,
        "same_password",
        "New password should be different from the old password.",
      );
    }
    // Test users are plain objects: the new password works for the next sign-in.
    /** @type {{ password: string }} */ (session.user).password = password;
    return send(response, 200, supabaseUser(session.user));
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
    if (session && url.searchParams.get("scope") === "others") {
      // The person's other sessions (other browsers); this one stays.
      for (const [id, other] of sessions) {
        if (id !== session.id && other.user === session.user) {
          sessions.set(id, { ...other, active: false });
        }
      }
    } else if (session) {
      sessions.set(session.id, { ...session, active: false });
    }
    return send(response, 204);
  }

  // e2e only: the link an invitation email would hold (the API sends invitations), and the one
  // the last "Forgot your password?" sent to an address.
  if (request.method === "GET" && url.pathname === "/__e2e/invite-link") {
    const email = String(url.searchParams.get("email") ?? "").toLowerCase();
    const user = users.find((candidate) => candidate.email === email);
    if (!user) return authError(response, 404, "not_found", "No such user");
    return send(response, 200, { token_hash: emailLink(user, "invite") });
  }
  if (request.method === "GET" && url.pathname === "/__e2e/recovery-link") {
    const email = String(url.searchParams.get("email") ?? "").toLowerCase();
    const tokenHash = lastRecovery.get(email);
    if (!tokenHash) return authError(response, 404, "not_found", "No email");
    return send(response, 200, { token_hash: tokenHash });
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
  // Running and full: route requests ask for a seat on it (GZ-027).
  {
    code: "B-07",
    corridorId: corridorId("Bole", "Piassa"),
    route_type: /** @type {const} */ ("public"),
    launch_minimum: 10,
    status: /** @type {const} */ ("active"),
    prices: { round_trip: 2400, one_way: 1400, saturday: 300 },
    taken: 14,
    hasRiders: true,
  },
  // A running student route of Lycée Guebre-Mariam.
  {
    code: "S-06",
    corridorId: corridorId("Megenagna", "Mexico"),
    route_type: /** @type {const} */ ("student"),
    school_name: "Lycée Guebre-Mariam",
    launch_minimum: 8,
    status: /** @type {const} */ ("active"),
    prices: { round_trip: 3000, one_way: 1700, saturday: null },
    taken: 12,
    hasRiders: true,
  },
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

// Route requests, like GZ-027: oldest first; one open request per phone, kind, route or area
// pair and rider; `new` → `matched` (again) → `fulfilled`, `new` → `fulfilled`, open →
// `declined` with a reason. Personal data is invented.
/**
 * @typedef {{
 *   id: string; kind: Schemas["RequestKind"];
 *   fromAreaId: string | null; from_area_name: string | null;
 *   toAreaId: string | null; to_area_name: string | null;
 *   routeId: string | null; rider_type: Schemas["RiderType"]; rider_name: string;
 *   school_name: string | null; preferred_morning_time: string | null;
 *   preferred_return_time: string | null; contact_name: string; contact_phone: string;
 *   notes: string | null; source: Schemas["RequestSource"]; status: Schemas["RequestStatus"];
 *   matchedRouteId: string | null; decline_reason: string | null; deleted: boolean;
 *   created_at: string; updated_at: string;
 * }} FakeRequest
 */
/** @param {string} code */
function routeIdOf(code) {
  const route = routes.find((candidate) => candidate.code === code);
  if (!route) throw new Error(`no seeded route ${code}`);
  return route.id;
}

/** @type {FakeRequest[]} */
const requests = [
  // From Ayat to an area not listed yet.
  {
    kind: "new_areas",
    fromAreaId: areaId("Ayat"),
    to_area_name: "Lebu",
    rider_name: "Selam Bekele",
    contact_name: "Selam Bekele",
    contact_phone: "+251911000101",
    preferred_morning_time: "07:00",
    preferred_return_time: "17:30",
  },
  // B-07 is full: a seat on it.
  {
    kind: "route",
    routeId: routeIdOf("B-07"),
    rider_name: "Dawit Alemu",
    contact_name: "Dawit Alemu",
    contact_phone: "+251911000102",
    notes: "Works near Piassa, any seat from next month.",
  },
  // A student, matched to S-03 (a route of their school still being set up).
  {
    kind: "new_areas",
    fromAreaId: areaId("Megenagna"),
    toAreaId: areaId("Mexico"),
    rider_type: "student",
    rider_name: "Liya Girma",
    school_name: "Lycée Guebre-Mariam",
    contact_name: "Meron Girma",
    contact_phone: "+251711000103",
    status: "matched",
    matchedRouteId: routeIdOf("S-03"),
  },
  {
    kind: "new_areas",
    from_area_name: "Summit",
    toAreaId: areaId("Piassa"),
    rider_name: "Kidus Tadesse",
    contact_name: "Kidus Tadesse",
    contact_phone: "+251911000104",
    status: "declined",
    decline_reason: "Too far from our corridors for now.",
  },
  {
    kind: "route",
    routeId: routeIdOf("B-07"),
    rider_name: "Hirut Mengistu",
    contact_name: "Hirut Mengistu",
    contact_phone: "+251911000105",
    status: "fulfilled",
  },
  // Someone else for the same pair (the name typed in other case): the pair counts 2.
  {
    kind: "new_areas",
    fromAreaId: areaId("Ayat"),
    to_area_name: "lebu",
    rider_name: "Tsion Haile",
    contact_name: "Tsion Haile",
    contact_phone: "+251911000106",
  },
  // Both ends listed: no corridor CMC → Mexico yet; Ayat → CMC has one (no route).
  {
    kind: "new_areas",
    fromAreaId: areaId("CMC"),
    toAreaId: areaId("Mexico"),
    rider_name: "Yonas Bekele",
    contact_name: "Yonas Bekele",
    contact_phone: "+251911000107",
  },
  {
    kind: "new_areas",
    fromAreaId: areaId("Ayat"),
    toAreaId: areaId("CMC"),
    rider_name: "Mahlet Tesfaye",
    contact_name: "Mahlet Tesfaye",
    contact_phone: "+251911000108",
  },
].map((seed, index) => {
  const at = new Date(Date.UTC(2026, 9, 10, 7, index)).toISOString();
  return {
    id: `00000000-0000-4000-e000-${String(index + 1).padStart(12, "0")}`,
    fromAreaId: null,
    from_area_name: null,
    toAreaId: null,
    to_area_name: null,
    routeId: null,
    rider_type: /** @type {Schemas["RiderType"]} */ ("adult"),
    school_name: null,
    preferred_morning_time: null,
    preferred_return_time: null,
    notes: null,
    source: /** @type {Schemas["RequestSource"]} */ ("staff"),
    status: /** @type {Schemas["RequestStatus"]} */ ("new"),
    matchedRouteId: null,
    decline_reason: null,
    deleted: false,
    created_at: at,
    updated_at: at,
    ...seed,
  };
});

/**
 * The demand summary, like GZ-027: open new-areas requests not matched yet per area pair (a name
 * not listed yet compared ignoring case, shown as first recorded), and open requests per route
 * (the one matched to, else the one asked for) next to its free seats next month; busiest first
 * (then the oldest), at most 100 of each.
 * @returns {Schemas["RouteRequestSummary"]}
 */
function demandSummary() {
  const LIMIT = 100;
  const live = requests
    .filter((request) => !request.deleted)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  /** @type {Map<string, { first: FakeRequest; open: number }>} */
  const pairs = new Map();
  for (const request of live) {
    if (request.kind !== "new_areas" || request.status !== "new") continue;
    const key = [
      request.fromAreaId ?? request.from_area_name?.toLowerCase(),
      request.toAreaId ?? request.to_area_name?.toLowerCase(),
    ].join("|");
    const pair = pairs.get(key);
    if (pair) pair.open += 1;
    else pairs.set(key, { first: request, open: 1 });
  }
  /** @type {Map<string, { first: FakeRequest; open: number }>} */
  const targets = new Map();
  for (const request of live) {
    const target = request.matchedRouteId ?? request.routeId;
    if (!isOpen(request) || target === null) continue;
    const counted = targets.get(target);
    if (counted) counted.open += 1;
    else targets.set(target, { first: request, open: 1 });
  }
  // Insertion order is the oldest first, so a stable sort by count keeps it as the tie-break.
  const busiest = (/** @type {Map<string, { open: number }>} */ counts) =>
    [...counts.entries()].sort((a, b) => b[1].open - a[1].open);
  const pairList = busiest(pairs);
  const routeList = busiest(targets).filter(([id]) =>
    routes.some((route) => route.id === id),
  );
  return {
    area_pairs: pairList.slice(0, LIMIT).map(([, { first, open }]) => ({
      from_area: first.fromAreaId === null ? null : areaRef(first.fromAreaId),
      from_area_name: first.from_area_name,
      to_area: first.toAreaId === null ? null : areaRef(first.toAreaId),
      to_area_name: first.to_area_name,
      open,
    })),
    area_pairs_truncated: pairList.length > LIMIT,
    routes: routeList.slice(0, LIMIT).map(([id, { open }]) => {
      const route = /** @type {FakeRoute} */ (routes.find((r) => r.id === id));
      return {
        route: { id: route.id, code: route.code },
        status: route.status,
        open,
        seats_free_next_month: Math.max(route.seats - route.taken, 0),
      };
    }),
    routes_truncated: routeList.length > LIMIT,
  };
}

/** @type {Map<string, { request: FakeRequest; fingerprint: string }>} */
const requestKeys = new Map();

const REQUEST_STATUSES = ["new", "matched", "fulfilled", "declined"];
const REQUEST_MOVES = [
  ["new", "matched"],
  ["matched", "matched"],
  ["new", "fulfilled"],
  ["matched", "fulfilled"],
  ["new", "declined"],
  ["matched", "declined"],
];

/** @param {FakeRequest} request */
function isOpen(request) {
  return request.status === "new" || request.status === "matched";
}

/** @param {string | null} id */
function routeRef(id) {
  const route = id === null ? undefined : routes.find((r) => r.id === id);
  return route ? { id: route.id, code: route.code } : null;
}

/**
 * @param {FakeRequest} request
 * @returns {Schemas["RouteRequestRead"]}
 */
function requestRead(request) {
  return {
    id: request.id,
    kind: request.kind,
    from_area: request.fromAreaId === null ? null : areaRef(request.fromAreaId),
    from_area_name: request.from_area_name,
    to_area: request.toAreaId === null ? null : areaRef(request.toAreaId),
    to_area_name: request.to_area_name,
    route: routeRef(request.routeId),
    rider_type: request.rider_type,
    rider_name: request.rider_name,
    school_name: request.school_name,
    preferred_morning_time: request.preferred_morning_time,
    preferred_return_time: request.preferred_return_time,
    contact_name: request.contact_name,
    contact_phone: request.contact_phone,
    notes: request.notes,
    source: request.source,
    status: request.status,
    matched_route: routeRef(request.matchedRouteId),
    decline_reason: request.decline_reason,
    created_at: request.created_at,
    updated_at: request.updated_at,
  };
}

/** A live, open request names the route (asks for it or is matched to it). */
function routeNamedByRequest(/** @type {FakeRoute} */ route) {
  return (
    route.hasRequests ||
    requests.some(
      (request) =>
        !request.deleted &&
        isOpen(request) &&
        (request.routeId === route.id || request.matchedRouteId === route.id),
    )
  );
}

/** A route for this rider: public for adults; student, of their school (any case), for students. */
function routeFits(
  /** @type {FakeRoute} */ route,
  /** @type {string} */ riderType,
  /** @type {string | null} */ school,
) {
  if (riderType === "adult") return route.route_type === "public";
  return (
    route.route_type === "student" &&
    route.school_name !== null &&
    school !== null &&
    route.school_name.toLowerCase() === school.toLowerCase()
  );
}

/** Another live, open request asks for the same (the API's unique rule). */
function sameRequestOpen(
  /** @type {Omit<FakeRequest, "id">} */ asked,
  /** @type {string | null} */ exceptId,
) {
  const end = (
    /** @type {string | null} */ id,
    /** @type {string | null} */ name,
  ) => id ?? name?.toLowerCase() ?? null;
  return requests.some(
    (other) =>
      other.id !== exceptId &&
      !other.deleted &&
      isOpen(other) &&
      other.contact_phone === asked.contact_phone &&
      other.kind === asked.kind &&
      other.routeId === asked.routeId &&
      end(other.fromAreaId, other.from_area_name) ===
        end(asked.fromAreaId, asked.from_area_name) &&
      end(other.toAreaId, other.to_area_name) ===
        end(asked.toAreaId, asked.to_area_name) &&
      other.rider_name.toLowerCase() === asked.rider_name.toLowerCase(),
  );
}

/**
 * The request fields in a body, checked and normalised like the API's models (create, or the
 * partial update: who and when).
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @param {{ partial: boolean }} options
 * @returns {Record<string, unknown> | undefined} undefined after a 422
 */
function requestFields(response, body, { partial }) {
  const who = [
    "rider_name",
    "school_name",
    "preferred_morning_time",
    "preferred_return_time",
    "contact_name",
    "contact_phone",
    "notes",
  ];
  const allowed = partial
    ? who
    : [
        "kind",
        "from_area_id",
        "from_area_name",
        "to_area_id",
        "to_area_name",
        "route_id",
        "rider_type",
        ...who,
      ];
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
  if (!partial) {
    if (!["new_areas", "route"].includes(String(body.kind))) {
      validationProblem(
        response,
        "/kind",
        body.kind === undefined ? "missing" : "not_allowed",
      );
      return undefined;
    }
    fields.kind = body.kind;
    for (const field of ["from_area_id", "to_area_id", "route_id"]) {
      const value = body[field] ?? null;
      if (value !== null && (typeof value !== "string" || !UUID.test(value))) {
        validationProblem(response, `/${field}`, "invalid_format");
        return undefined;
      }
      fields[field] = value;
    }
    for (const field of ["from_area_name", "to_area_name"]) {
      if (body[field] === undefined || body[field] === null) {
        fields[field] = null;
        continue;
      }
      const text = shortText(response, body[field], field);
      if (text === undefined) return undefined;
      fields[field] = text;
    }
    if (!["adult", "student"].includes(String(body.rider_type))) {
      validationProblem(
        response,
        "/rider_type",
        body.rider_type === undefined ? "missing" : "not_allowed",
      );
      return undefined;
    }
    fields.rider_type = body.rider_type;
  }
  for (const field of ["rider_name", "school_name", "contact_name"]) {
    const optional = partial || field === "school_name";
    if (optional && (body[field] === undefined || body[field] === null)) {
      if (!partial) fields[field] = null;
      continue;
    }
    const text = shortText(response, body[field], field);
    if (text === undefined) return undefined;
    fields[field] = text;
  }
  for (const field of ["preferred_morning_time", "preferred_return_time"]) {
    const value = body[field];
    if (value === undefined || value === null) {
      if (!partial) fields[field] = null;
      continue;
    }
    if (typeof value !== "string" || !LOCAL_TIME.test(value)) {
      validationProblem(response, `/${field}`, "invalid_format");
      return undefined;
    }
    fields[field] = value;
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
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string") {
      validationProblem(response, "/notes", "invalid_type");
      return undefined;
    }
    const notes = body.notes.trim();
    if (notes.length > 1000) {
      validationProblem(response, "/notes", "too_long");
      return undefined;
    }
    fields.notes = notes;
  } else if (!partial) {
    fields.notes = null;
  }
  if (partial) return fields;
  // The model's own checks (a 422 on the whole body): one thing asked for, a school for
  // students only, the times in order.
  const ends = [
    [fields.from_area_id, fields.from_area_name],
    [fields.to_area_id, fields.to_area_name],
  ];
  const wellFormed =
    fields.kind === "route"
      ? fields.route_id !== null && ends.every(([id, name]) => !id && !name)
      : fields.route_id === null &&
        ends.every(([id, name]) => (id === null) !== (name === null)) &&
        (fields.from_area_id === null ||
          fields.from_area_id !== fields.to_area_id) &&
        (fields.from_area_name === null ||
          fields.to_area_name === null ||
          String(fields.from_area_name).toLowerCase() !==
            String(fields.to_area_name).toLowerCase());
  const schoolFits =
    (fields.school_name !== null) === (fields.rider_type === "student");
  const morning = fields.preferred_morning_time;
  const back = fields.preferred_return_time;
  const inOrder =
    morning === null || back === null || String(back) > String(morning);
  if (!wellFormed || !schoolFits || !inOrder) {
    validationProblem(response, "", "invalid");
    return undefined;
  }
  return fields;
}

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listRequests(url, response) {
  const status = url.searchParams.get("status");
  if (status !== null && !REQUEST_STATUSES.includes(status)) {
    return validationProblem(response, "/status", "not_allowed", "query");
  }
  const kind = url.searchParams.get("kind");
  if (kind !== null && !["new_areas", "route"].includes(kind)) {
    return validationProblem(response, "/kind", "not_allowed", "query");
  }
  const open = url.searchParams.get("open");
  if (open !== null && !["true", "false"].includes(open)) {
    return validationProblem(response, "/open", "invalid_type", "query");
  }
  const routeId = url.searchParams.get("route_id");
  if (routeId !== null && !UUID.test(routeId)) {
    return validationProblem(response, "/route_id", "invalid_format", "query");
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
  const matching = requests
    .filter(
      (request) =>
        !request.deleted &&
        (status === null || request.status === status) &&
        (kind === null || request.kind === kind) &&
        (open === null || isOpen(request) === (open === "true")) &&
        (routeId === null ||
          request.routeId === routeId ||
          request.matchedRouteId === routeId),
    )
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  /** @type {Schemas["RouteRequestPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit).map(requestRead),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// Staff, like GZ-013/GZ-069 (admins only): newest first; an invite adds an active member who is
// "pending" until their first sign-in; no change may leave no active admin who has signed in.
// The test users are members too (their own /v1/staff/me answer and access stay as
// test-users.mjs says): e2e tests must not demote or deactivate them, or the sample members.
/** @typedef {Schemas["StaffRead"]} FakeStaff */
/** @type {FakeStaff[]} */
const staffMembers = [
  { ...testUsers.admin.staff, signedIn: true },
  { ...testUsers.staff.staff, signedIn: true },
  {
    id: "00000000-0000-4000-8000-000000000003",
    full_name: "Meron Admin",
    email: "meron@gize.test",
    role: /** @type {const} */ ("admin"),
    signedIn: true,
  },
  // Invited, never signed in.
  {
    id: "00000000-0000-4000-8000-000000000004",
    full_name: "Hana Tesfaye",
    email: "hana@gize.test",
    role: /** @type {const} */ ("staff"),
    signedIn: false,
  },
  // Deactivated: an invite to this email is refused (reactivate them).
  {
    id: "00000000-0000-4000-8000-000000000005",
    full_name: "Dawit Former",
    email: "dawit@gize.test",
    role: /** @type {const} */ ("staff"),
    signedIn: true,
    is_active: false,
  },
].map(({ signedIn, ...seed }, index) => {
  const at = new Date(Date.UTC(2026, 9, 1, 8, index)).toISOString();
  return {
    is_active: true,
    first_signed_in_at: signedIn ? at : null,
    created_at: at,
    updated_at: at,
    ...seed,
  };
});

/** Emails with a sign-in account but no staff member (Supabase refuses to invite them). */
const signInOnly = new Set([testUsers.outsider.email]);

/** @type {Map<string, { member: FakeStaff; fingerprint: string }>} */
const staffKeys = new Map();

const STAFF_EMAIL = EMAIL;

/**
 * The staff fields in a body, checked and normalised like the API's models.
 * @param {ServerResponse} response
 * @param {Record<string, unknown>} body
 * @param {{ partial: boolean }} options
 * @returns {Partial<FakeStaff> | undefined} undefined after a 422
 */
function staffFields(response, body, { partial }) {
  const allowed = partial
    ? ["full_name", "role", "is_active"]
    : ["email", "full_name", "role"];
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
  /** @type {Partial<FakeStaff>} */
  const fields = {};
  if (!partial) {
    const email = body.email;
    if (typeof email !== "string") {
      validationProblem(
        response,
        "/email",
        email === undefined ? "missing" : "invalid_type",
      );
      return undefined;
    }
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length > 320) {
      validationProblem(response, "/email", "too_long");
      return undefined;
    }
    if (!STAFF_EMAIL.test(trimmed)) {
      validationProblem(response, "/email", "invalid_format");
      return undefined;
    }
    fields.email = trimmed;
  }
  if (!partial || body.full_name !== undefined) {
    const name = body.full_name;
    if (typeof name !== "string") {
      validationProblem(
        response,
        "/full_name",
        name === undefined ? "missing" : "invalid_type",
      );
      return undefined;
    }
    const trimmed = name.trim();
    if (trimmed === "") {
      validationProblem(response, "/full_name", "too_short");
      return undefined;
    }
    // The API refuses control characters in a name.
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
      validationProblem(response, "/full_name", "invalid");
      return undefined;
    }
    if (trimmed.length > 200) {
      validationProblem(response, "/full_name", "too_long");
      return undefined;
    }
    fields.full_name = trimmed;
  }
  if (!partial || body.role !== undefined) {
    if (!["admin", "staff"].includes(String(body.role))) {
      validationProblem(
        response,
        "/role",
        body.role === undefined ? "missing" : "not_allowed",
      );
      return undefined;
    }
    fields.role = /** @type {Schemas["StaffRole"]} */ (body.role);
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

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listStaff(url, response) {
  const unknown = [...url.searchParams.keys()].find(
    (key) => !["role", "is_active", "limit", "cursor"].includes(key),
  );
  if (unknown) {
    return validationProblem(response, `/${unknown}`, "unknown_field", "query");
  }
  const role = url.searchParams.get("role");
  if (role !== null && !["admin", "staff"].includes(role)) {
    return validationProblem(response, "/role", "not_allowed", "query");
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
  const matching = staffMembers
    .filter(
      (member) =>
        (role === null || member.role === role) &&
        (active === null || member.is_active === (active === "true")),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  /** @type {Schemas["StaffPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// The audit log, like GZ-012 (admins only): newest first; filtered by an entity (type and ID
// together) or an actor. Personal values read "[redacted]". Fixed sample entries: the stand-in
// doesn't record its own changes.
const ADMIN_ID = testUsers.admin.staff.id;
const STAFF_ID = testUsers.staff.staff.id;
/** @type {Schemas["AuditEntryRead"][]} */
const auditEntries = [
  {
    action: "staff.first_admin_created",
    actor_staff_id: null,
    entity_type: "staff",
    entity_id: ADMIN_ID,
    before: null,
    after: {
      full_name: "[redacted]",
      email: "[redacted]",
      role: "admin",
      is_active: true,
    },
  },
  {
    action: "staff.role_changed",
    actor_staff_id: ADMIN_ID,
    entity_type: "staff",
    entity_id: "00000000-0000-4000-8000-000000000003",
    before: { role: "staff" },
    after: { role: "admin" },
  },
  {
    action: "company.updated",
    actor_staff_id: STAFF_ID,
    entity_type: "company",
    entity_id: "00000000-0000-4000-c000-000000000001",
    before: { contact_phone: "[redacted]", notes: null },
    after: { contact_phone: "[redacted]", notes: "[redacted]" },
  },
  {
    action: "area.renamed",
    actor_staff_id: ADMIN_ID,
    entity_type: "area",
    entity_id: "00000000-0000-4000-a000-000000000003",
    before: { name: "Mexiko" },
    after: { name: "Mexico" },
  },
  {
    action: "route.prices_changed",
    actor_staff_id: ADMIN_ID,
    entity_type: "route",
    entity_id: "00000000-0000-4000-d000-000000000003",
    before: { price_round_trip: null, price_one_way: null },
    after: { price_round_trip: 2400, price_one_way: 1400 },
  },
  {
    action: "route.status_changed",
    actor_staff_id: STAFF_ID,
    entity_type: "route",
    entity_id: "00000000-0000-4000-d000-000000000003",
    before: { status: "draft" },
    after: { status: "forming" },
  },
  {
    action: "route_request.created",
    actor_staff_id: STAFF_ID,
    entity_type: "route_request",
    entity_id: "00000000-0000-4000-e000-000000000002",
    before: null,
    after: {
      kind: "route",
      rider_type: "adult",
      rider_name: "[redacted]",
      contact_name: "[redacted]",
      contact_phone: "[redacted]",
      status: "new",
    },
  },
].map((seed, index) => ({
  id: `00000000-0000-4000-f000-${String(index + 1).padStart(12, "0")}`,
  created_at: new Date(Date.UTC(2026, 9, 2, 9, index * 7)).toISOString(),
  request_id: `req-sample-${index + 1}`,
  ...seed,
}));

/**
 * @param {URL} url
 * @param {ServerResponse} response
 */
function listAudit(url, response) {
  const unknown = [...url.searchParams.keys()].find(
    (key) =>
      ![
        "entity_type",
        "entity_id",
        "actor_staff_id",
        "limit",
        "cursor",
      ].includes(key),
  );
  if (unknown) {
    return validationProblem(response, `/${unknown}`, "unknown_field", "query");
  }
  const type = url.searchParams.get("entity_type");
  if (type !== null && type.length > 50) {
    return validationProblem(response, "/entity_type", "too_long", "query");
  }
  if (type !== null && !/^[a-z][a-z_]*$/.test(type)) {
    return validationProblem(
      response,
      "/entity_type",
      "invalid_format",
      "query",
    );
  }
  /** @type {Record<string, string | null>} */
  const ids = {};
  for (const name of ["entity_id", "actor_staff_id"]) {
    const value = url.searchParams.get(name);
    if (value !== null && !UUID.test(value)) {
      return validationProblem(response, `/${name}`, "invalid_format", "query");
    }
    ids[name] = value;
  }
  // An entity is its type and ID together.
  if ((type === null) !== (ids.entity_id === null)) {
    return validationProblem(response, "", "invalid", "query");
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
  const matching = auditEntries
    .filter(
      (entry) =>
        (type === null ||
          (entry.entity_type === type && entry.entity_id === ids.entity_id)) &&
        (ids.actor_staff_id === null ||
          entry.actor_staff_id === ids.actor_staff_id),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  /** @type {Schemas["AuditEntryPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// Riders, like GZ-034/GZ-035: newest first, `q` the start of a name (ignoring case), phones
// masked in lists and found with a POST; an adult's phone is theirs alone, a company rider's once
// per company; a rider holding a seat can't be deleted, and their changes must fit its route.
/**
 * @typedef {{
 *   id: string;
 *   rider_type: Schemas["gize_api__riders__models__RiderType"];
 *   full_name: string;
 *   phone: string;
 *   companyId: string | null;
 *   homeId: string;
 *   destinationId: string | null;
 *   plan: Schemas["RiderPlan"] | null;
 *   saturday_addon: boolean;
 *   source: Schemas["RiderSource"];
 *   seat: FakeSeat | null;
 *   nextSeat: FakeSeat | null;
 *   open_requests: number;
 *   deleted: boolean;
 *   created_at: string;
 *   updated_at: string;
 * }} FakeRider
 * @typedef {{ routeId: string; status: "reserved" | "active"; start_date: string; end_date: string | null }} FakeSeat
 */
/** @type {FakeRider[]} */
const riders = [
  {
    full_name: "Abel Tesfaye",
    phone: "+251911000412",
    homeId: areaId("Bole"),
    destinationId: areaId("Piassa"),
    plan: /** @type {const} */ ("round_trip"),
    seat: {
      routeId: routeIdOf("B-07"),
      status: /** @type {const} */ ("active"),
      start_date: "2026-09-01",
      end_date: null,
    },
  },
  {
    full_name: "Kidus Alemu",
    phone: "+251911000208",
    homeId: areaId("Megenagna"),
    destinationId: areaId("Piassa"),
    plan: /** @type {const} */ ("morning"),
    source: /** @type {const} */ ("app"),
    open_requests: 1,
    seat: {
      routeId: routeIdOf("B-01"),
      status: /** @type {const} */ ("reserved"),
      start_date: "2099-12-01",
      end_date: null,
    },
  },
  {
    full_name: "Hirut Bekele",
    phone: "+251911000303",
    rider_type: /** @type {const} */ ("corporate"),
    companyId: companyId("Addis Brewery"),
    homeId: areaId("Bole"),
    destinationId: null,
    plan: null,
  },
  // No seat: one an admin may delete (one per Playwright project).
  { full_name: "Selam Girma", phone: "+251911000501" },
  { full_name: "Selam Girmay", phone: "+251911000502" },
].map((seed, index) => {
  const at = new Date(Date.UTC(2026, 9, 1, 8, index)).toISOString();
  return {
    id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
    rider_type: /** @type {FakeRider["rider_type"]} */ ("adult"),
    companyId: null,
    homeId: areaId("CMC"),
    destinationId: areaId("Mexico"),
    plan: /** @type {FakeRider["plan"]} */ ("round_trip"),
    saturday_addon: false,
    source: /** @type {FakeRider["source"]} */ ("staff"),
    seat: null,
    nextSeat: null,
    open_requests: 0,
    deleted: false,
    created_at: at,
    updated_at: at,
    ...seed,
  };
});
/** "staff email|Idempotency-Key" → the rider recorded and the request's fingerprint. */
/** @type {Map<string, { rider: FakeRider; fingerprint: string }>} */
const riderKeys = new Map();
const PLANS = ["round_trip", "morning", "evening"];

/** @param {FakeRider} rider @returns {Schemas["RiderRead"]} */
function riderRead(rider) {
  const company = companies.find((c) => c.id === rider.companyId);
  return {
    id: rider.id,
    rider_type: rider.rider_type,
    full_name: rider.full_name,
    phone: rider.phone,
    home_area: areaRef(rider.homeId),
    destination_area: rider.destinationId ? areaRef(rider.destinationId) : null,
    plan: rider.plan,
    saturday_addon: rider.saturday_addon,
    source: rider.source,
    company: company ? { id: company.id, name: company.name } : null,
    seat: seatRef(rider.seat),
    next_seat: seatRef(rider.nextSeat),
    open_requests: rider.open_requests,
    created_at: rider.created_at,
    updated_at: rider.updated_at,
  };
}

/** @param {FakeSeat | null} seat @returns {Schemas["SeatRef"] | null} */
function seatRef(seat) {
  const route = seat && routes.find((r) => r.id === seat.routeId);
  if (!seat || !route) return null;
  return {
    route_id: route.id,
    route_code: route.code,
    status: seat.status,
    start_date: seat.start_date,
    end_date: seat.end_date,
  };
}

/** @param {FakeRider} rider @returns {Schemas["RiderListItem"]} */
function riderListItem(rider) {
  const { phone, ...read } = riderRead(rider);
  return {
    ...read,
    phone_masked: phone ? `${phone.slice(0, 5)}****${phone.slice(-4)}` : null,
  };
}

/** An Ethiopian mobile as stored, or undefined after a 422. */
/** @param {ServerResponse} response @param {unknown} value */
function riderPhone(response, value) {
  const match =
    typeof value === "string" && value.length <= 20
      ? MOBILE.exec(value.trim().replace(/[  \t().-]/g, ""))
      : null;
  if (!match) {
    validationProblem(response, "/phone", "invalid");
    return undefined;
  }
  return `+251${match[1]}`;
}

/** Another live rider who already has this phone (adults: anyone adult; company: same company). */
/** @param {string} phone @param {string | null} companyId @param {string | null} exceptId */
function phoneTaken(phone, companyId, exceptId) {
  return riders.some(
    (r) =>
      !r.deleted &&
      r.id !== exceptId &&
      r.phone === phone &&
      (companyId === null
        ? r.rider_type !== "corporate"
        : r.companyId === companyId),
  );
}

/** Where the seat's route lets them board: its start or an area it serves. */
/** @param {FakeRider} rider @param {string} areaId */
function boardsOnSeatRoute(rider, areaId) {
  const route = rider.seat && routes.find((r) => r.id === rider.seat?.routeId);
  if (!route) return true;
  const corridor = corridors.find((c) => c.id === route.corridorId);
  return corridor?.originId === areaId || route.servedAreaIds.includes(areaId);
}

/** @param {URL} url @param {ServerResponse} response */
function listRiders(url, response) {
  const type = url.searchParams.get("rider_type");
  if (type !== null && !["adult", "student", "corporate"].includes(type)) {
    return validationProblem(response, "/rider_type", "not_allowed", "query");
  }
  const seat = url.searchParams.get("seat");
  if (seat !== null && !["reserved", "active", "none"].includes(seat)) {
    return validationProblem(response, "/seat", "not_allowed", "query");
  }
  const routeId = url.searchParams.get("route_id");
  if (routeId !== null && !UUID.test(routeId)) {
    return validationProblem(response, "/route_id", "invalid_format", "query");
  }
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const limit = Number(url.searchParams.get("limit") ?? 25);
  const cursor = url.searchParams.get("cursor");
  const offset =
    cursor === null ? 0 : Number(Buffer.from(cursor, "base64url").toString());
  if (cursor === "" || !Number.isInteger(offset) || offset < 0) {
    return problem(response, 422, "INVALID_CURSOR");
  }
  const matching = riders
    .filter(
      (r) =>
        !r.deleted &&
        r.full_name.toLowerCase().startsWith(q) &&
        (type === null || r.rider_type === type) &&
        (seat === null ||
          (seat === "none" ? r.seat === null : r.seat?.status === seat)) &&
        (routeId === null || r.seat?.routeId === routeId),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  /** @type {Schemas["RiderPage"]} */
  const page = {
    items: matching.slice(offset, offset + limit).map(riderListItem),
    next_cursor:
      offset + limit < matching.length
        ? Buffer.from(String(offset + limit)).toString("base64url")
        : null,
  };
  send(response, 200, page);
}

// Seats, like GZ-035: an adult rides a public route that takes their trip from a 1st (a
// reservation on a forming route, a place on an active one); a company rider their company's
// route from any day. A move ends the old seat the day before; others' open requests for an
// active route come first (a skip reason), then the seats.
/** @type {Map<string, { rider: FakeRider; fingerprint: string }>} */
const seatKeys = new Map();

/** Today in Addis Ababa, YYYY-MM-DD. */
const addisDay = () => addisToday().toISOString().slice(0, 10);

/** @param {string} day @param {number} days */
function shiftDay(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The route takes a rider boarding at `fromId` and getting off at `toId` (A or served → B). */
/** @param {FakeRoute} route @param {string} fromId @param {string} toId */
function takesTrip(route, fromId, toId) {
  const corridor = corridors.find((c) => c.id === route.corridorId);
  return (
    corridor !== undefined &&
    corridor.destinationId === toId &&
    (corridor.originId === fromId || route.servedAreaIds.includes(fromId))
  );
}

/** No seat free from the earliest start (fixed counts: the stand-in has no real seats). */
/** @param {FakeRoute} route */
function routeFull(route) {
  return (
    (route.status === "forming" ? route.reserved : route.taken) >= route.seats
  );
}

/** @param {FakeRoute} route @param {FakeRider} rider */
function routeTakesRider(route, rider) {
  if (rider.rider_type === "corporate") {
    const corridor = corridors.find((c) => c.id === route.corridorId);
    return (
      route.route_type === "corporate" &&
      route.companyId === rider.companyId &&
      corridor !== undefined &&
      takesTrip(route, rider.homeId, corridor.destinationId)
    );
  }
  return (
    route.route_type === "public" &&
    ["forming", "active"].includes(route.status) &&
    route.prices !== null &&
    route.prices.round_trip !== null &&
    route.prices.one_way !== null &&
    (!rider.saturday_addon || route.prices.saturday !== null) &&
    rider.destinationId !== null &&
    takesTrip(route, rider.homeId, rider.destinationId)
  );
}

/** @param {URL} url @param {ServerResponse} response */
function listPublicRoutes(url, response) {
  const fromId = url.searchParams.get("from_area_id") ?? "";
  const toId = url.searchParams.get("to_area_id") ?? "";
  /** @type {Schemas["PublicRoutePage"]} */
  const page = {
    items: routes
      .filter(
        (route) =>
          route.route_type === "public" &&
          ["forming", "active", "paused"].includes(route.status) &&
          route.prices?.round_trip != null &&
          route.prices.one_way != null &&
          takesTrip(route, fromId, toId),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((route) => {
        const corridor = corridors.find((c) => c.id === route.corridorId);
        return {
          id: route.id,
          code: route.code,
          origin_area: areaRef(corridor?.originId ?? ""),
          destination_area: areaRef(corridor?.destinationId ?? ""),
          served_areas: route.servedAreaIds.map(areaRef),
          morning_time: route.morning_time,
          morning_arrival_time: route.morning_arrival_time,
          return_time: route.return_time,
          return_arrival_time: route.return_arrival_time,
          prices: {
            round_trip: Number(route.prices?.round_trip),
            one_way: Number(route.prices?.one_way),
            saturday: route.prices?.saturday ?? null,
          },
          status: /** @type {Schemas["RouteStatus"]} */ (route.status),
          full: routeFull(route),
        };
      }),
    next_cursor: null,
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

  if (url.pathname === "/v1/audit-log" && request.method === "GET") {
    if (!isAdmin) return problem(response, 403, "FORBIDDEN");
    return listAudit(url, response);
  }

  // Staff management (GZ-013): admins only, before anything else.
  const staffMatch = /^\/v1\/staff(?:\/([^/]+))?$/.exec(url.pathname);
  if (staffMatch && staffMatch[1] !== "me") {
    if (!isAdmin) return problem(response, 403, "FORBIDDEN");
    const id = staffMatch[1];
    if (id === undefined && request.method === "GET") {
      return listStaff(url, response);
    }
    if (id === undefined && request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = (await readJson(request)) ?? {};
      const fingerprint = JSON.stringify(body);
      const fields = staffFields(response, body, { partial: false });
      if (!fields) return;
      const replay = staffKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, replay.member, {
          "Idempotent-Replayed": "true",
        });
      }
      if (staffMembers.some((member) => member.email === fields.email)) {
        return problem(response, 409, "STAFF_EMAIL_TAKEN");
      }
      if (signInOnly.has(String(fields.email))) {
        return problem(response, 409, "AUTH_ACCOUNT_EXISTS");
      }
      const now = new Date().toISOString();
      /** @type {FakeStaff} */
      const member = {
        id: randomUUID(),
        full_name: String(fields.full_name),
        email: String(fields.email),
        role: /** @type {Schemas["StaffRole"]} */ (fields.role),
        is_active: true,
        first_signed_in_at: null,
        created_at: now,
        updated_at: now,
      };
      staffMembers.push(member);
      staffKeys.set(`${user.email}|${key}`, { member, fingerprint });
      return send(response, 201, member, {
        Location: `/v1/staff/${member.id}`,
      });
    }
    if (id !== undefined) {
      if (!UUID.test(id)) {
        return validationProblem(
          response,
          "/staff_id",
          "invalid_format",
          "path",
        );
      }
      // The body is validated before the member is looked up, as FastAPI does.
      const body = request.method === "PATCH" ? await readJson(request) : {};
      const fields =
        request.method === "PATCH"
          ? staffFields(response, body ?? {}, { partial: true })
          : {};
      if (!fields) return;
      const member = staffMembers.find((candidate) => candidate.id === id);
      if (!member) return problem(response, 404, "NOT_FOUND");
      if (request.method === "GET") return send(response, 200, member);
      if (request.method === "PATCH") {
        const role = fields.role ?? member.role;
        const isActive = fields.is_active ?? member.is_active;
        const wasAdmin = member.role === "admin" && member.is_active;
        const staysAdmin = role === "admin" && isActive;
        const otherAdmin = staffMembers.some(
          (other) =>
            other.id !== member.id &&
            other.role === "admin" &&
            other.is_active &&
            other.first_signed_in_at !== null,
        );
        if (wasAdmin && !staysAdmin && !otherAdmin) {
          return problem(response, 409, "LAST_ACTIVE_ADMIN");
        }
        Object.assign(member, fields, { updated_at: new Date().toISOString() });
        return send(response, 200, member);
      }
    }
  }

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
      if (routeNamedByRequest(route))
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
      if (relocates && routeNamedByRequest(route)) {
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

  // Route requests (GZ-027): any staff member; delete is admin-only.
  if (url.pathname === "/v1/public/routes" && request.method === "GET") {
    return listPublicRoutes(url, response);
  }

  const seatMatch = /^\/v1\/riders\/([^/]+)\/seat(\/end)?$/.exec(url.pathname);
  if (
    seatMatch &&
    ((request.method === "PUT" && !seatMatch[2]) ||
      (request.method === "POST" && seatMatch[2]))
  ) {
    const key = idempotencyKey(request, response);
    if (key === undefined) return;
    const body = (await readJson(request)) ?? {};
    const fingerprint = `${url.pathname}|${JSON.stringify(body)}`;
    const replay = seatKeys.get(`${user.email}|${key}`);
    if (replay) {
      if (replay.fingerprint !== fingerprint) {
        return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
      }
      return send(response, 200, riderRead(replay.rider));
    }
    const found = riders.find((r) => r.id === seatMatch[1] && !r.deleted);
    if (!found) return problem(response, 404, "NOT_FOUND");
    const today = addisDay();
    const company = found.rider_type === "corporate";

    if (seatMatch[2]) {
      // A rider leaves: an adult at a month's end, a company rider any day.
      if (found.seat === null)
        return problem(response, 409, "RIDER_HAS_NO_SEAT");
      const last =
        typeof body.end_date === "string"
          ? body.end_date
          : company
            ? today
            : shiftDay(nextLaunchDay(), -1);
      const monthEnd = shiftDay(last, 1).endsWith("-01");
      if (
        last < today ||
        last > shiftDay(today, 365) ||
        (!company && !monthEnd)
      ) {
        return validationProblem(response, "/end_date", "invalid");
      }
      found.nextSeat = null;
      if (found.seat.status === "reserved" || last < found.seat.start_date) {
        found.seat = null;
      } else if (found.seat.end_date === null || found.seat.end_date > last) {
        found.seat.end_date = last;
      }
      found.updated_at = new Date().toISOString();
      seatKeys.set(`${user.email}|${key}`, { rider: found, fingerprint });
      return send(response, 200, riderRead(found));
    }

    const route = routes.find((r) => r.id === body.route_id);
    if (!route || !routeTakesRider(route, found)) {
      return validationProblem(response, "/route_id", "invalid");
    }
    if (company && !activeCompany(String(found.companyId))) {
      return problem(response, 409, "ROUTE_NOT_READY");
    }
    if (found.seat?.routeId === route.id) {
      // Back on the route of the seat they hold: its end is undone, a move ends.
      if (found.seat.end_date === null && found.nextSeat === null) {
        return problem(response, 409, "ALREADY_ON_ROUTE");
      }
      found.seat.end_date = null;
      found.nextSeat = null;
      found.updated_at = new Date().toISOString();
      seatKeys.set(`${user.email}|${key}`, { rider: found, fingerprint });
      return send(response, 200, riderRead(found));
    }
    if (found.nextSeat !== null) return problem(response, 409, "RIDER_MOVING");
    if (found.seat?.status === "active" && route.status === "forming") {
      return validationProblem(response, "/route_id", "invalid");
    }
    const start =
      typeof body.start_date === "string"
        ? body.start_date
        : company
          ? today
          : nextLaunchDay();
    if (
      start < today ||
      start > shiftDay(today, 366) ||
      (!company && (!start.endsWith("-01") || start < nextLaunchDay()))
    ) {
      return validationProblem(response, "/start_date", "invalid");
    }
    if (!company && route.status === "active" && !body.skip_reason) {
      const waiting = requests.some(
        (r) =>
          !r.deleted &&
          isOpen(r) &&
          (r.routeId === route.id || r.matchedRouteId === route.id) &&
          r.contact_phone !== found.phone,
      );
      if (waiting) return problem(response, 409, "ROUTE_HAS_WAITING_REQUESTS");
    }
    if (routeFull(route)) return problem(response, 409, "ROUTE_FULL");
    /** @type {FakeSeat} */
    const seat = {
      routeId: route.id,
      status: route.status === "forming" ? "reserved" : "active",
      start_date: start,
      end_date: null,
    };
    // Seat counts stay as seeded: other tests read them (launch progress).
    const current = found.seat;
    if (
      current === null ||
      current.status === "reserved" ||
      current.start_date > today
    ) {
      found.seat = seat;
    } else {
      current.end_date = shiftDay(start, -1);
      found.nextSeat = seat;
    }
    found.updated_at = new Date().toISOString();
    seatKeys.set(`${user.email}|${key}`, { rider: found, fingerprint });
    return send(response, 200, riderRead(found));
  }

  if (url.pathname === "/v1/riders/lookup" && request.method === "POST") {
    const body = (await readJson(request)) ?? {};
    const phone = riderPhone(response, body.phone);
    if (phone === undefined) return;
    /** @type {Schemas["RiderMatches"]} */
    const matches = {
      items: riders
        .filter((r) => !r.deleted && r.phone === phone)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(riderListItem),
    };
    return send(response, 200, matches);
  }

  if (url.pathname === "/v1/riders") {
    if (request.method === "GET") return listRiders(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = (await readJson(request)) ?? {};
      const fingerprint = JSON.stringify(body);
      const fullName = shortText(response, body.full_name, "full_name");
      if (fullName === undefined) return;
      const phone = riderPhone(response, body.phone);
      if (phone === undefined) return;
      const type = body.rider_type ?? "adult";
      const company = type === "corporate";
      // The model's rules for each type (a 422 on the body, like the API's validator).
      const fits = company
        ? typeof body.company_id === "string" &&
          body.destination_area_id === undefined &&
          body.plan === undefined &&
          body.saturday_addon !== true
        : type === "adult" &&
          body.company_id === undefined &&
          typeof body.destination_area_id === "string" &&
          PLANS.includes(String(body.plan)) &&
          body.destination_area_id !== body.home_area_id;
      if (!fits) return validationProblem(response, "", "invalid");
      const replay = riderKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, riderRead(replay.rider), {
          "Idempotent-Replayed": "true",
        });
      }
      for (const field of ["home_area_id", "destination_area_id"]) {
        const id = body[field];
        if (id !== undefined && !areas.some((area) => area.id === id)) {
          return validationProblem(response, `/${field}`, "invalid");
        }
      }
      if (company && !activeCompany(String(body.company_id))) {
        return validationProblem(response, "/company_id", "invalid");
      }
      const companyId = company ? String(body.company_id) : null;
      if (phoneTaken(phone, companyId, null)) {
        return problem(response, 409, "RIDER_EXISTS");
      }
      const now = new Date().toISOString();
      /** @type {FakeRider} */
      const added = {
        id: randomUUID(),
        rider_type: company ? "corporate" : "adult",
        full_name: fullName,
        phone,
        companyId,
        homeId: String(body.home_area_id),
        destinationId: company ? null : String(body.destination_area_id),
        plan: company ? null : /** @type {Schemas["RiderPlan"]} */ (body.plan),
        saturday_addon: body.saturday_addon === true,
        source: "staff",
        seat: null,
        nextSeat: null,
        open_requests: 0,
        deleted: false,
        created_at: now,
        updated_at: now,
      };
      riders.push(added);
      riderKeys.set(`${user.email}|${key}`, { rider: added, fingerprint });
      return send(response, 201, riderRead(added), {
        Location: `/v1/riders/${added.id}`,
      });
    }
  }

  const riderMatch = /^\/v1\/riders\/([^/]+)$/.exec(url.pathname);
  if (riderMatch) {
    // Delete is admin-only (a dependency, before anything else).
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    if (!UUID.test(riderMatch[1] ?? "")) {
      return validationProblem(response, "/rider_id", "invalid_format", "path");
    }
    const body =
      request.method === "PATCH" ? ((await readJson(request)) ?? {}) : {};
    const found = riders.find((r) => r.id === riderMatch[1] && !r.deleted);
    if (!found) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET") return send(response, 200, riderRead(found));
    if (request.method === "DELETE") {
      if (found.seat !== null) return problem(response, 409, "RIDER_HAS_SEAT");
      found.deleted = true;
      return send(response, 204);
    }
    if (request.method === "PATCH") {
      /** @type {Partial<FakeRider>} */
      const change = {};
      if (body.full_name !== undefined) {
        const name = shortText(response, body.full_name, "full_name");
        if (name === undefined) return;
        change.full_name = name;
      }
      if (body.phone !== undefined) {
        const phone = riderPhone(response, body.phone);
        if (phone === undefined) return;
        if (phoneTaken(phone, found.companyId, found.id)) {
          return problem(response, 409, "RIDER_EXISTS");
        }
        change.phone = phone;
      }
      if (body.home_area_id !== undefined) {
        const id = String(body.home_area_id);
        if (!areas.some((a) => a.id === id) || !boardsOnSeatRoute(found, id)) {
          return validationProblem(response, "/home_area_id", "invalid");
        }
        change.homeId = id;
      }
      if (body.destination_area_id !== undefined) {
        if (found.rider_type === "corporate") {
          return validationProblem(response, "/destination_area_id", "invalid");
        }
        change.destinationId = String(body.destination_area_id);
      }
      if (body.plan !== undefined) {
        if (
          found.rider_type === "corporate" ||
          !PLANS.includes(String(body.plan))
        ) {
          return validationProblem(response, "/plan", "invalid");
        }
        change.plan = /** @type {Schemas["RiderPlan"]} */ (body.plan);
      }
      if (body.saturday_addon !== undefined) {
        if (found.rider_type === "corporate") {
          return validationProblem(response, "/saturday_addon", "invalid");
        }
        change.saturday_addon = body.saturday_addon === true;
      }
      Object.assign(found, change, { updated_at: new Date().toISOString() });
      return send(response, 200, riderRead(found));
    }
  }

  if (url.pathname === "/v1/route-requests") {
    if (request.method === "GET") return listRequests(url, response);
    if (request.method === "POST") {
      const key = idempotencyKey(request, response);
      if (key === undefined) return;
      const body = (await readJson(request)) ?? {};
      const fingerprint = JSON.stringify(body);
      const fields = requestFields(response, body, { partial: false });
      if (!fields) return;
      const replay = requestKeys.get(`${user.email}|${key}`);
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return problem(response, 422, "IDEMPOTENCY_KEY_MISMATCH");
        }
        return send(response, 201, requestRead(replay.request), {
          "Idempotent-Replayed": "true",
        });
      }
      // What it names first: one that doesn't exist or fit is a 422 on its field.
      for (const field of ["from_area_id", "to_area_id"]) {
        const id = fields[field];
        if (id !== null && !areas.some((area) => area.id === id)) {
          return validationProblem(response, `/${field}`, "invalid");
        }
      }
      if (fields.route_id !== null) {
        const route = routes.find((r) => r.id === fields.route_id);
        if (
          !route ||
          !["active", "paused"].includes(route.status) ||
          !routeFits(
            route,
            String(fields.rider_type),
            /** @type {string | null} */ (fields.school_name),
          )
        ) {
          return validationProblem(response, "/route_id", "invalid");
        }
      }
      const now = new Date().toISOString();
      /** @type {FakeRequest} */
      const added = {
        id: randomUUID(),
        kind: /** @type {Schemas["RequestKind"]} */ (fields.kind),
        fromAreaId: /** @type {string | null} */ (fields.from_area_id),
        from_area_name: /** @type {string | null} */ (fields.from_area_name),
        toAreaId: /** @type {string | null} */ (fields.to_area_id),
        to_area_name: /** @type {string | null} */ (fields.to_area_name),
        routeId: /** @type {string | null} */ (fields.route_id),
        rider_type: /** @type {Schemas["RiderType"]} */ (fields.rider_type),
        rider_name: String(fields.rider_name),
        school_name: /** @type {string | null} */ (fields.school_name),
        preferred_morning_time: /** @type {string | null} */ (
          fields.preferred_morning_time
        ),
        preferred_return_time: /** @type {string | null} */ (
          fields.preferred_return_time
        ),
        contact_name: String(fields.contact_name),
        contact_phone: String(fields.contact_phone),
        notes: fields.notes ? String(fields.notes) : null,
        source: "staff",
        status: "new",
        matchedRouteId: null,
        decline_reason: null,
        deleted: false,
        created_at: now,
        updated_at: now,
      };
      if (sameRequestOpen(added, null)) {
        return problem(response, 409, "ROUTE_REQUEST_EXISTS");
      }
      requests.push(added);
      requestKeys.set(`${user.email}|${key}`, { request: added, fingerprint });
      return send(response, 201, requestRead(added), {
        Location: `/v1/route-requests/${added.id}`,
      });
    }
  }

  if (
    url.pathname === "/v1/route-requests/summary" &&
    request.method === "GET"
  ) {
    return send(response, 200, demandSummary());
  }

  const requestStatusMatch = /^\/v1\/route-requests\/([^/]+)\/status$/.exec(
    url.pathname,
  );
  if (requestStatusMatch && request.method === "PUT") {
    if (!UUID.test(requestStatusMatch[1] ?? "")) {
      return validationProblem(
        response,
        "/request_id",
        "invalid_format",
        "path",
      );
    }
    const body = (await readJson(request)) ?? {};
    const unknown = Object.keys(body).find(
      (field) =>
        !["status", "matched_route_id", "decline_reason"].includes(field),
    );
    if (unknown)
      return validationProblem(response, `/${unknown}`, "unknown_field");
    if (!REQUEST_STATUSES.includes(String(body.status))) {
      return validationProblem(
        response,
        "/status",
        body.status === undefined ? "missing" : "not_allowed",
      );
    }
    const to = /** @type {Schemas["RequestStatus"]} */ (body.status);
    const matchedRouteId = body.matched_route_id ?? null;
    if (
      matchedRouteId !== null &&
      (typeof matchedRouteId !== "string" || !UUID.test(matchedRouteId))
    ) {
      return validationProblem(response, "/matched_route_id", "invalid_format");
    }
    let reason = null;
    if (body.decline_reason !== undefined && body.decline_reason !== null) {
      reason = shortText(response, body.decline_reason, "decline_reason");
      if (reason === undefined) return;
    }
    // Each goes with its own status, and only with it.
    if ((matchedRouteId !== null) !== (to === "matched")) {
      return validationProblem(response, "/matched_route_id", "invalid");
    }
    if ((reason !== null) !== (to === "declined")) {
      return validationProblem(response, "/decline_reason", "invalid");
    }
    const found = requests.find(
      (candidate) =>
        candidate.id === requestStatusMatch[1] && !candidate.deleted,
    );
    if (!found) return problem(response, 404, "NOT_FOUND");
    if (matchedRouteId !== null) {
      const route = routes.find((r) => r.id === matchedRouteId);
      if (!route || !routeFits(route, found.rider_type, found.school_name)) {
        return validationProblem(response, "/matched_route_id", "invalid");
      }
    }
    const sameRoute =
      matchedRouteId === null || matchedRouteId === found.matchedRouteId;
    if (to === found.status && sameRoute) {
      return send(response, 200, requestRead(found));
    }
    if (
      !REQUEST_MOVES.some(
        ([from, next]) => from === found.status && next === to,
      )
    ) {
      return problem(response, 409, "INVALID_STATUS_CHANGE");
    }
    if (matchedRouteId !== null) found.matchedRouteId = matchedRouteId;
    found.status = to;
    found.decline_reason = reason;
    found.updated_at = new Date().toISOString();
    return send(response, 200, requestRead(found));
  }

  const requestMatch = /^\/v1\/route-requests\/([^/]+)$/.exec(url.pathname);
  if (requestMatch && requestMatch[1] !== "summary") {
    // Delete is admin-only (a dependency, before anything else).
    if (request.method === "DELETE" && !isAdmin) {
      return problem(response, 403, "FORBIDDEN");
    }
    if (!UUID.test(requestMatch[1] ?? "")) {
      return validationProblem(
        response,
        "/request_id",
        "invalid_format",
        "path",
      );
    }
    // The body is validated before the request is looked up, as FastAPI does.
    const body = request.method === "PATCH" ? await readJson(request) : {};
    const fields =
      request.method === "PATCH"
        ? requestFields(response, body ?? {}, { partial: true })
        : {};
    if (!fields) return;
    const found = requests.find(
      (candidate) => candidate.id === requestMatch[1] && !candidate.deleted,
    );
    if (!found) return problem(response, 404, "NOT_FOUND");
    if (request.method === "GET")
      return send(response, 200, requestRead(found));
    if (request.method === "DELETE") {
      found.deleted = true;
      return send(response, 204);
    }
    if (request.method === "PATCH") {
      if (fields.school_name !== undefined) {
        const school = /** @type {string} */ (fields.school_name);
        const named = [
          found.routeId,
          isOpen(found) ? found.matchedRouteId : null,
        ]
          .map((id) => routes.find((r) => r.id === id))
          .filter((route) => route !== undefined);
        if (
          found.rider_type !== "student" ||
          named.some((route) => !routeFits(route, "student", school))
        ) {
          return validationProblem(response, "/school_name", "invalid");
        }
      }
      const morning =
        fields.preferred_morning_time ?? found.preferred_morning_time;
      const back = fields.preferred_return_time ?? found.preferred_return_time;
      if (
        morning !== null &&
        back !== null &&
        String(back) <= String(morning)
      ) {
        const field =
          fields.preferred_return_time !== undefined
            ? "preferred_return_time"
            : "preferred_morning_time";
        return validationProblem(response, `/${field}`, "invalid");
      }
      const changed = /** @type {FakeRequest} */ ({
        ...found,
        ...fields,
        notes: fields.notes === undefined ? found.notes : fields.notes || null,
      });
      if (isOpen(found) && sameRequestOpen(changed, found.id)) {
        return problem(response, 409, "ROUTE_REQUEST_EXISTS");
      }
      Object.assign(found, changed, { updated_at: new Date().toISOString() });
      return send(response, 200, requestRead(found));
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
