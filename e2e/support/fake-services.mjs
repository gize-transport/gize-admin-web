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

// Areas, like GZ-026: names unique ignoring case, newest first, `q` matches the start of a name.
/** @typedef {Schemas["AreaRead"] & { usedByCorridor?: boolean }} FakeArea */
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
    // Deleting it is refused (AREA_IN_USE), as if a corridor used it.
    usedByCorridor: name === "Bole",
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
      const key = request.headers["idempotency-key"];
      if (typeof key !== "string" || key === "") {
        return problem(response, 428, "IDEMPOTENCY_KEY_REQUIRED");
      }
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
      if (area.usedByCorridor) return problem(response, 409, "AREA_IN_USE");
      areas.splice(areas.indexOf(area), 1);
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
