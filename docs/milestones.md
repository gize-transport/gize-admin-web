# Milestones and tickets – admin portal

One ticket = one branch = one PR titled `GZW-xxx: <title>`. Statuses: `todo` → `in progress` → `in review` → `done`. "Needs backend" lists the `GZ-xxx` tickets (backend repo) that must be merged and tagged first. Every ticket includes `docs/engineering-standards.md` as acceptance criteria.

---

## W0 – Foundation

### GZW-001 · Scaffold and tooling
Status: done · Needs backend: –
- Scaffold with `create-next-app` (TypeScript, Tailwind, ESLint, App Router, `src/`, alias `@/*`, npm) into a temp folder and move it into the repo root without overwriting `CLAUDE.md`, `PROMPT.md`, `docs/`, `.github/`.
- Prettier, TypeScript strict, Vitest + Testing Library, Playwright + axe, pre-commit (lint-staged, gitleaks), `.env.example`.
- Acceptance: `npm run build`, `lint`, `typecheck`, `test`, `e2e` (one smoke test) all pass.

### GZW-002 · CI
Status: done · Needs backend: –
- GitHub Actions: install, lint, typecheck, unit tests, build, Playwright (with axe), `npm audit --audit-level=high`, gitleaks.

### GZW-003 · Contract sync and drift checks
Status: todo · Needs backend: GZ-015 (first tag `api-v1.0.0`; latest `api-v1.4.0`)
- `scripts/contract-sync.mjs`: downloads `openapi.json` and `docs/api-contract.md` from `gize-admin-api` at a tag (default latest `api-v*`) via `gh`; writes `src/lib/api/openapi.json`, regenerates `schema.d.ts` (openapi-typescript), writes `CONTRACT_VERSION`, copies `api-contract.md` to `docs/`.
- CI: regenerate and fail on any diff. Scheduled daily job: if a newer `api-v*` tag exists, open an issue with the `oasdiff changelog`.
- Acceptance: editing `schema.d.ts` by hand fails CI.

### GZW-004 · API client and error handling
Status: todo · Needs backend: GZ-015 (latest `api-v1.4.0`)
- `lib/api/client.ts` (openapi-fetch, base URL from env, bearer token from Supabase session, `Idempotency-Key` helper, request ID capture), problem+json parsing (`Problem`, and `ValidationProblem` with `errors[].field` JSON pointers), `errors.ts` exhaustive map over the `ErrorCode` enum, TanStack Query provider with retry rules; 401 → sign-in, 429 and 503 → retry after `Retry-After`.
- Time helpers: timestamps (ISO UTC) formatted in Africa/Addis_Ababa; schedule times (`"HH:MM"`) passed through unchanged.
- `lib/env.ts` zod-validated env.

### GZW-005 · Design tokens and shared components
Status: done · Needs backend: –
- Tokens and fonts from `design-system.md`; shadcn/ui themed; `PageHeader`, `DataTable` (cursor pagination, URL filters, skeletons), `StatusPill`, `ConfirmDialog`, `ProblemAlert`, `EmptyState`, toast. Storybook not required; a `/dev/components` page (dev only) shows them.

### GZW-006 · Deployment pipeline
Status: todo · Needs backend: –
- Cloudflare Workers via OpenNext; preview deploy per PR, production on `main`; security headers and CSP.

### GZW-007 · Docs and tickets for the two customer types
Status: in review · Needs backend: GZ-025
- Docs only: product brief, architecture, design system, engineering standards and these tickets, for prepaid individuals and postpaid companies, forming routes, route requests and "add a van" (backend owner decisions, GZ-025). Replaces the waitlist screens.

---

## Build order

Screens are built in the order their backend tickets are tagged (`npm run contract:sync`), never before. Available now (latest `api-v1.4.0`): `staff_me`, staff management and audit log (`api-v1.2.0`), areas (`api-v1.3.0`), corridors (`api-v1.4.0`) – so after W0 come W1, W6, GZW-026 and GZW-020. The rest of W2 and W4 follow backend M2 (GZ-029, 021, 022, 023, 024, 027, 028), W3 follows M3, W5 follows M5.

### Questions for the backend (answer before the matching ticket starts)

The UI must not work these out itself (no business rules in the frontend), so each needs a field or endpoint, or a decision:

1. **What a route still needs** (GZW-024): does `ROUTE_NOT_READY` say what is missing (prices, a pickup point), or does the route response carry it? Otherwise the UI can only say "not ready".
2. **Can it launch?** (GZW-021, GZW-024): launch progress is "reserved for which month"? Does the route say when the launch minimum is reached for a given month, so the UI never compares numbers itself?
3. **Pickers need search** (GZW-021, 029, 031, 040): `/v1/routes` by code and `/v1/companies` by name. (Answered for places in `api-v1.4.0`: areas search by name with `q`; corridors filter by `origin_area_id` / `destination_area_id`, so the corridor picker is two area pickers.)
4. **All status moves** (GZW-024): the planned endpoints are open, activate and pause – which ones cover `forming → draft` and resuming a paused route?
5. **Demand summary** (GZW-041): its shape (area pairs without a corridor yet, routes with free seats next month) and limits.

---

## W1 – Sign-in and shell

### GZW-010 · Sign in and session
Status: todo · Needs backend: GZ-010, GZ-011 (in `api-v1.2.0`)
- Supabase email/password sign-in, `@supabase/ssr` cookies, middleware protection, sign-out; calls `GET /v1/staff/me` (`staff_me`) – 401 goes to sign-in, 403 signs out with a clear message.

### GZW-011 · Portal shell and role-aware navigation
Status: todo · Needs backend: GZ-011 (in `api-v1.2.0`)
- Sidebar (MVP items only: Overview, Routes, Route requests, Demand, Companies, Riders, Drivers; Areas and Corridors under a "Places" group; Staff and Audit log for Admin only), header with user and role, responsive drawer; 403 and 404 pages.

---

## W2 – Places, companies and routes

### GZW-026 · Areas · Needs backend: GZ-026 (in `api-v1.3.0`) · Status: todo
- `areas_list` (search `q`, 1–100 characters), `areas_create` (`Idempotency-Key` per action, reused on retry), `areas_update` (rename), `areas_get`; name 1–100 characters, `AREA_NAME_TAKEN` on the name field. Admin delete (`areas_delete`): `AREA_IN_USE` explained ("a corridor uses this area"); a deleted area's name can be used again.
- Shared `AreaPicker` (searchable, keyboard-accessible combobox over the areas list) used by corridors, pickup points and route requests.

### GZW-020 · Corridors · Needs backend: GZ-020 (in `api-v1.4.0`) · Status: todo
- `corridors_list` shows "origin → destination" with area names from the response; filters by origin and/or destination area (two area pickers, kept in the URL). Create (`Idempotency-Key`) and edit with two area pickers; an unknown area is a field error; `CORRIDOR_EXISTS` explained. Corridors have a direction: the way back (B → A) is a separate corridor, so the UI always shows the arrow.
- Admin delete (`corridors_delete`) with confirmation. The API doesn't refuse it yet; `CORRIDOR_IN_USE` (routes use the corridor) arrives with GZ-021 – handle it then. No threshold.

### GZW-029 · Companies · Needs backend: GZ-029 · Status: todo
- List (search, active/inactive filter), detail (contact person, billing postpaid, notes, the company's routes), create and edit; deactivate (`COMPANY_IN_USE` explained); admin delete. Contact name, phone and email are personal data: never in URLs, logs or Sentry.

### GZW-021 · Routes list and detail · Needs backend: GZ-021 · Status: todo
- List filters (type, status, corridor, company); columns: code + corridor, type (school or company), morning and return times (`HH:MM` as sent), seats taken/free this month and next, status with launch progress for forming routes ("9 of 12").
- Detail (side panel ≥ 1280 px, page otherwise) per the routes mockup; create and edit: type decides school name (`student`) or company picker (`corporate`, active companies only); launch minimum only for `public`/`student`. Errors: `ROUTE_CODE_TAKEN`, `SEATS_BELOW_TAKEN`, `SEATS_BELOW_LAUNCH_MINIMUM`, `ROUTE_HAS_RIDERS`.

### GZW-022 · Route prices (admin) · Needs backend: GZ-022 · Status: todo
- Round trip, one-way, Saturday add-on (`public` only, optional), whole birr. Admin edits, Staff read-only. Corporate routes show "Rate agreed with the company" and no price form.

### GZW-023 · Pickup points · Needs backend: GZ-023, GZ-026 · Status: todo
- Add, edit, remove, reorder (keyboard-accessible): area picker, description, morning pickup time (`HH:MM`), optional location (latitude and longitude together). Staff may remove a stop (`PICKUP_POINT_HAS_RIDERS`, `LAST_PICKUP_POINT` explained).

### GZW-024 · Route status and deletion · Needs backend: GZ-024 · Status: todo
- Individual routes: start forming (`ROUTE_NOT_READY` shows what's missing), back to draft, launch (launch date = the 1st of a month, launch progress shown, `NOT_ENOUGH_RIDERS` explained), pause, resume. Corporate routes: start service, pause, resume. `INVALID_STATUS_CHANGE` explained. Each action through ConfirmDialog, one idempotent request.
- Admin delete with confirmation (`ROUTE_HAS_RIDERS`).

### GZW-028 · Add a van · Needs backend: GZ-028 · Status: todo
- From route detail: new code, seats and launch minimum; copies stops, times, prices, type, school or company. The result says whether the copy starts `forming` or `draft` and opens it. `Idempotency-Key`.

---

## W3 – Riders

### GZW-030 · Riders list and detail · Needs backend: GZ-034 · Status: todo
- Search, filters (type, status, route), detail with guardian/children or company, edit, admin delete.

### GZW-031 · Assign rider to route · Needs backend: GZ-035 · Status: todo
- Dialog: route → pickup point → plan → Saturday add-on. Individual riders start on the 1st of a month (reservation on a forming route, place on an active one) and leave at a month's end; company riders (recorded by staff: name, phone, company) start and stop on any day. A skip reason is required when the API reports older open requests for the route. `ROUTE_FULL` explained with an offer to record a route request; rule violations explained; idempotent.

---

## W4 – Route requests and demand

### GZW-040 · Route requests · Needs backend: GZ-027 · Status: todo
- List with filters (status, kind, route, area pair) and detail. Record a request from a phone call: kind *new areas* (from/to area pickers, or free text for an area not listed yet) or *a specific route* (route picker); rider type, school, preferred times, contact name and phone, notes, source. `ROUTE_REQUEST_EXISTS` links to the open request.
- Actions: match to a route, mark fulfilled, decline with a reason; admin delete.

### GZW-041 · Demand · Needs backend: GZ-027 · Status: todo
- Open requests per area pair and per route, next to each route's free seats next month (summary endpoint). From an area pair: create a corridor or route for it; from a full route: add a van (GZW-028). Card layout from `AdminWaitlists.png`, brand colours.

### GZW-042 · Seat offers and skips · Needs backend: GZ-040 · Status: todo
- Free seats offered to the oldest open request, offer status and expiry; skipping a request needs a reason (audited). Scope confirmed when GZ-040's contract is tagged.

### GZW-043 · Company days without service · Needs backend: GZ-042 · Status: todo
- Record and list dates a company's route does not run (date, reason, who asked), per route and company. Scope confirmed when GZ-042's contract is tagged.

---

## W5 – Drivers

### GZW-050 · Drivers and vehicles · Needs backend: GZ-050 · Status: todo
Applications list with status tabs, create/edit driver and vehicle.

### GZW-051 · Driver documents · Needs backend: GZ-051 · Status: todo
Upload via signed URLs (type/size checked first, progress), view via short-lived links.

### GZW-052 · Inspection and approval · Needs backend: GZ-052 · Status: todo
Record inspection; approve/reject enabled only when the API allows; missing requirements listed.

### GZW-053 · Assign driver to route · Needs backend: GZ-053 · Status: todo
From route detail; only eligible drivers offered; API errors explained.

---

## W6 – Admin tools

### GZW-060 · Staff accounts · Needs backend: GZ-013 (in `api-v1.2.0`) · Status: todo
- List, detail, invite (`email`, `full_name`, `role`; `Idempotency-Key` per action, reused on retry), change role, deactivate and reactivate (`PATCH` with `role` and/or `is_active`). "Pending" while `first_signed_in_at` is null. Errors: `LAST_ACTIVE_ADMIN`, `STAFF_EMAIL_TAKEN` (offer to reactivate the existing person), `AUTH_ACCOUNT_EXISTS`; field errors mapped from `errors[].field` (`/email`).

### GZW-061 · Audit log · Needs backend: GZ-012 (in `api-v1.2.0`) · Status: todo
- Newest first; filter by entity (`entity_type` + `entity_id` together) or by actor (`actor_staff_id`); before/after view showing `"[redacted]"` values as redacted, not as data.

---

## W7 – Release

### GZW-070 · Overview page · Needs backend: GZ-064 · Status: todo
Counts and "needs action" items from the summary endpoint only.

### GZW-071 · Full regression and accessibility pass · Needs backend: all above · Status: todo
Playwright suite for every MVP flow against staging; axe clean; Lighthouse targets met.

### GZW-072 · Production launch · Needs backend: GZ-062 · Status: todo
Production env vars, domain (e.g. `admin.gizetransport.com`), CSP verified, runbook section for the portal.
