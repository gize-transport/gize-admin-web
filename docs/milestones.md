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
Status: done · Needs backend: GZ-015 (first tag `api-v1.0.0`; latest `api-v2.5.0`)
- `scripts/contract-sync.mjs`: downloads `openapi.json` and `docs/api-contract.md` from `gize-admin-api` at a tag (default latest `api-v*`) via `gh`; writes `src/lib/api/openapi.json`, regenerates `schema.d.ts` (openapi-typescript), writes `CONTRACT_VERSION`, copies `api-contract.md` to `docs/`.
- CI: regenerate and fail on any diff. Scheduled daily job: if a newer `api-v*` tag exists, open an issue with the `oasdiff changelog`.
- Acceptance: editing `schema.d.ts` by hand fails CI.

### GZW-004 · API client and error handling
Status: todo · Needs backend: GZ-015 (latest `api-v2.5.0`)
- `lib/api/client.ts` (openapi-fetch, base URL from env, bearer token from Supabase session, `Idempotency-Key` helper, request ID capture), problem+json parsing (`Problem`, and `ValidationProblem` with `errors[].field` JSON pointers), `errors.ts` exhaustive map over the `ErrorCode` enum, TanStack Query provider with retry rules; 401 → sign-in, 429 and 503 → retry after `Retry-After`.
- Time helpers: timestamps (ISO UTC) formatted in Africa/Addis_Ababa; schedule times (`"HH:MM"`) passed through unchanged.
- `lib/env.ts` zod-validated env.

### GZW-005 · Design tokens and shared components
Status: done · Needs backend: –
- Tokens and fonts from `design-system.md`; shadcn/ui themed; `PageHeader`, `DataTable` (cursor pagination, URL filters, skeletons), `StatusPill`, `ConfirmDialog`, `ProblemAlert`, `EmptyState`, toast. Storybook not required; a `/dev/components` page (dev only) shows them.

### GZW-006 · Deployment pipeline
Status: todo · Needs backend: –
- Cloudflare Workers via OpenNext; preview deploy per PR, production on `main`; security headers and CSP (`connect-src` allows the API origin from `NEXT_PUBLIC_API_BASE_URL`, e.g. `http://localhost:8000` locally, and the Supabase project).

### GZW-007 · Docs and tickets for the two customer types
Status: done · Needs backend: GZ-025
- Docs only: product brief, architecture, design system, engineering standards and these tickets, for prepaid individuals and postpaid companies, forming routes, route requests and "add a van" (backend owner decisions, GZ-025). Replaces the waitlist screens.
- Updated for `api-v2.5.0`: routes go A → B with arrival times and areas served (no pickup points), route readiness (`status_changes`) and launch months (GZ-067), picker search, the demand summary, and running against the local API with sample data (GZ-068).

---

## Build order

Screens are built in the order their backend tickets are tagged (`npm run contract:sync`), never before. Available now (latest `api-v2.5.0`): `staff_me`, staff management and audit log (`api-v1.2.0`), areas (`api-v1.3.0`), corridors (`api-v1.4.0`), companies (`api-v1.5.0`), route prices (`api-v1.6.0`), route times and areas served (`api-v2.0.0`), route status and deletion (`api-v2.1.0`), route requests and the demand summary (`api-v2.2.0`), add a van (`api-v2.3.0`), frozen corridor and school (`api-v2.4.0`), route readiness and launch months (`api-v2.5.0`). So after W0 come W1, all of W2, GZW-040 and GZW-041, and W6. GZW-042 and GZW-043 wait for GZ-040 and GZ-042, W3 for M3, W5 for M5.

### Questions for the backend

Answered in `api-v2.5.0` (GZ-067): what a route still needs and when it can launch (`status_changes`, `GET /v1/routes/{route_id}/launch-months`), picker search (`/v1/routes?q=` code prefix, `/v1/companies?q=&is_active=true` name prefix), every status move through `PUT /v1/routes/{route_id}/status`, and the demand summary's shape. The tickets below use them.

Still open (not blocking; ask before the ticket starts):

6. **Route request moves** (GZW-040): requests have no `status_changes`. Is offering match / fulfil / decline from the documented flow (`new` → `matched` → `fulfilled`, `new` → `fulfilled`, `new`/`matched` → `declined`) and explaining `INVALID_STATUS_CHANGE` enough, or should requests list their allowed moves like routes?

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
- `areas_list` (search `q`, 1–100 characters), `areas_create` (`Idempotency-Key` per action, reused on retry), `areas_update` (rename), `areas_get`; name 1–100 characters, `AREA_NAME_TAKEN` on the name field. Admin delete (`areas_delete`): `AREA_IN_USE` explained ("a corridor, a route or an open route request uses this area"); a deleted area's name can be used again.
- Shared `AreaPicker` (searchable, keyboard-accessible combobox over the areas list) used by corridors, areas served and route requests.

### GZW-020 · Corridors · Needs backend: GZ-020 (in `api-v1.4.0`), GZ-021 · Status: todo
- `corridors_list` shows "origin → destination" with area names from the response; filters by origin and/or destination area (two area pickers, kept in the URL). Create (`Idempotency-Key`) and edit with two area pickers; an unknown area is a field error; `CORRIDOR_EXISTS` explained. Corridors have a direction: the way back (B → A) is a separate corridor, so the UI always shows the arrow.
- Changing a corridor's areas or deleting it is refused while a live route uses it (`CORRIDOR_IN_USE`, explained). Admin delete with confirmation. No threshold.

### GZW-029 · Companies · Needs backend: GZ-029 (in `api-v1.5.0`) · Status: todo
- `companies_list` (search `q`: names starting with the text, ignoring case; active filter `is_active`), `companies_get` with the company's routes (`routes_list?company_id=`), `companies_create` (`Idempotency-Key`; name, contact name, phone and email required; notes optional; billing `postpaid` shown read-only), `companies_update` (fields, and `is_active` to deactivate or reactivate). Errors: `COMPANY_NAME_TAKEN` on the name field, `COMPANY_IN_USE` (deactivating while one of its routes is active or paused; deleting while it has a route). Admin delete.
- Shared `CompanyPicker` (`is_active=true`) for corporate routes. Contact name, phone and email are personal data: never in URLs, logs or Sentry. Phones may be typed any usual way; the API stores `+2519…`/`+2517…`.

### GZW-021 · Routes list and detail · Needs backend: GZ-021, GZ-023 (in `api-v2.0.0`) · Status: todo
- `routes_list` filters: search by code (`q`, codes starting with the text), type, status, corridor, company. Columns: code + corridor ("A → B"), type (school or company), times, seats taken/free this month and next (`seats_taken`/`seats_free`, busiest day), status with launch progress for forming routes (`reserved` of `launch_minimum`: "9 of 12").
- Times are four, in order: leaves A (`morning_time`), arrives at B (`morning_arrival_time`), leaves B (`return_time`), arrives at A (`return_arrival_time`), shown as sent. Routes made before arrival times existed show them as "Not set"; editing them needs both at once.
- Detail (side panel ≥ 1280 px, page otherwise) per the routes mockup: corridor, areas served in order, times, seats, prices (GZW-022), status actions (GZW-024), "copied from" (a deleted original shows as deleted, not an error). Shared `RoutePicker` (search by code) for requests and riders.
- Create (`Idempotency-Key`) and edit: code (2–20, letters, digits, hyphens), corridor picker, type (fixed after creation) deciding school name (`student`) or company picker (`corporate`, active companies only), the four times, seats 1–60, launch minimum (`public`/`student` only, 1 to seats). Errors: `ROUTE_CODE_TAKEN`, `SEATS_BELOW_TAKEN`, `SEATS_BELOW_LAUNCH_MINIMUM`, `ROUTE_HAS_RIDERS`, `ROUTE_HAS_PRICES` and `ROUTE_HAS_REQUESTS` (corridor and school are fixed once the route has prices or open requests: "add a new route to serve somewhere else"); times out of order and a corridor change while areas are served are field errors.

### GZW-022 · Route prices (admin) · Needs backend: GZ-022 (in `api-v1.6.0`) · Status: todo
- `routes_set_prices` (admin): round trip and one-way required, Saturday add-on optional (`public` only), whole birr 1–100,000, all sent at once. Staff see prices read-only; unset prices show "Not set". Corporate routes (`prices` null) show "Rate agreed with the company" and no price form (`ROUTE_HAS_NO_PRICES` handled anyway).

### GZW-023 · Areas served · Needs backend: GZ-023 (in `api-v2.0.0`), GZ-026 · Status: todo
- On route detail: the areas a route passes between A and B, in order, no times (replaces pickup points, owner decision 2026-10-31). Edit as one list – add with the area picker, remove, reorder (keyboard-accessible: move up / move down buttons) – saved with `routes_set_areas` (whole list, staff). Not A or B, each area once, at most 20: field errors from the API shown on the list. Shown as "A → CMC → Megenagna → B".

### GZW-024 · Route status and deletion · Needs backend: GZ-024 (in `api-v2.1.0`), GZ-067 (in `api-v2.5.0`) · Status: todo
- Actions come from the route's `status_changes` (the moves its type allows from its status): one button per move, enabled only when `ready`, otherwise disabled with its `blocked_by` reasons shown next to it (`PRICES_MISSING`: "an admin must set the round-trip and one-way prices"; `COMPANY_INACTIVE`; `ROUTE_HAS_RIDERS`: "someone is reserved"; `NOT_ENOUGH_RIDERS` with `reserved` of `launch_minimum`). The UI never works these out itself. Labels by move: draft → forming "Start forming", forming → draft "Back to draft", forming → active "Launch", draft → active (corporate) "Start service", active → paused "Pause", paused → active "Resume".
- Every move is `routes_set_status` (`PUT`, `{status}`), through ConfirmDialog. Launch: a dialog lists `routes_launch_months` (the 1st of each month up to a year ahead, riders reserved for each, `ready`); staff pick a ready month (default the change's `launch_date`) and send `{status: "active", launch_date}`. A launch for a later month makes the route active at once, riders starting that day – say so in the dialog.
- Readiness is a snapshot: a 409 (`ROUTE_NOT_READY`, `NOT_ENOUGH_RIDERS`, `ROUTE_HAS_RIDERS`, `INVALID_STATUS_CHANGE`) shows the message in the dialog and reloads the route. Each change's response is the updated route.
- Admin delete with confirmation (`ROUTE_HAS_RIDERS`, `ROUTE_HAS_REQUESTS` explained).

### GZW-028 · Add a van · Needs backend: GZ-028 (in `api-v2.3.0`) · Status: todo
- From route detail: `routes_copy` (`Idempotency-Key`) with new code, seats and launch minimum (individual routes); it copies corridor, type, school or company, times, areas served and prices (unchanged). The result says whether the copy starts `forming` or `draft` and opens it. Errors: `ROUTE_CODE_TAKEN`, `ROUTE_NOT_READY` (a corporate route's company is inactive).

---

## W3 – Riders

### GZW-030 · Riders list and detail · Needs backend: GZ-034 · Status: todo
- Search, filters (type, status, route), detail with guardian/children or company, edit, admin delete.

### GZW-031 · Assign rider to route · Needs backend: GZ-035 · Status: todo
- Dialog: route → boarding area (A or an area served) → plan → Saturday add-on; scope confirmed when GZ-035's contract is tagged. Individual riders start on the 1st of a month (reservation on a forming route, place on an active one) and leave at a month's end; company riders (recorded by staff: name, phone, company) start and stop on any day. A skip reason is required when the API reports older open requests for the route. `ROUTE_FULL` explained with an offer to record a route request; rule violations explained; idempotent.

---

## W4 – Route requests and demand

### GZW-040 · Route requests · Needs backend: GZ-027 (in `api-v2.2.0`) · Status: todo
- `route_requests_list` (oldest first) with filters status, kind, open, route (route picker); no search by phone or name (phones never go in URLs). Detail with the request's areas or route, matched route, decline reason, source (`staff`, set by the API).
- Record a request from a phone call (`route_requests_create`, `Idempotency-Key`): kind *new areas* (each end an area picker, or a name for an area not listed yet; ends different) or *a specific route* (route picker over running routes); rider type (adult/student), rider name, school (students), preferred morning and return times (optional), contact name and phone (a student's parent or guardian), notes. `ROUTE_REQUEST_EXISTS` points to the open request. Edit who and when only (`route_requests_update`); what is asked for doesn't change.
- Actions (`route_requests_set_status`): match to a route (route picker), mark fulfilled, decline with a reason (1–100 characters); `INVALID_STATUS_CHANGE` explained (see question 6). Admin delete. Contact and rider names and phones are personal data: never in URLs, logs or Sentry.

### GZW-041 · Demand · Needs backend: GZ-027 (in `api-v2.2.0`) · Status: todo
- `route_requests_summary`, two lists, busiest first, at most 100 each: **area pairs** (open new-areas requests not matched yet, between areas no route serves yet: listed area or a name not listed yet at each end, and the count) and **routes** (open requests waiting for a route, its status and `seats_free_next_month`). When a list is cut (`*_truncated`), say "Showing the 100 busiest".
- From an area pair: open its requests; when both ends are listed areas, offer "Add corridor" or "Add route" prefilled; a name not listed yet offers "Add area" first. From a route: open it, or add a van (GZW-028). Card layout from `AdminWaitlists.png`, brand colours.

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
