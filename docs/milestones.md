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
- GitHub Actions: install, lint, typecheck, unit tests, build, Playwright (with axe), `npm audit` (high and critical fail; dated owner exceptions in `audit-exceptions.json`), gitleaks.

### GZW-003 · Contract sync and drift checks
Status: done · Needs backend: GZ-015 (first tag `api-v1.0.0`; latest `api-v2.5.0`)
- `scripts/contract-sync.mjs`: downloads `openapi.json` and `docs/api-contract.md` from `gize-admin-api` at a tag (default latest `api-v*`) via `gh`; writes `src/lib/api/openapi.json`, regenerates `schema.d.ts` (openapi-typescript), writes `CONTRACT_VERSION`, copies `api-contract.md` to `docs/`.
- CI: regenerate and fail on any diff. Scheduled daily job: if a newer `api-v*` tag exists, open an issue with the `oasdiff changelog`.
- Acceptance: editing `schema.d.ts` by hand fails CI.

### GZW-004 · API client and error handling
Status: done · Needs backend: GZ-015 (latest `api-v2.5.0`)
- `lib/api/client.ts` (openapi-fetch, base URL from env, bearer token from Supabase session, `Idempotency-Key` helper, request ID capture), problem+json parsing (`Problem`, and `ValidationProblem` with `errors[].field` JSON pointers), `errors.ts` exhaustive map over the `ErrorCode` enum, TanStack Query provider with retry rules; 401 → sign-in, 429 and 503 → retry after `Retry-After`.
- Time helpers: timestamps (ISO UTC) formatted in Africa/Addis_Ababa; schedule times (`"HH:MM"`) passed through unchanged.
- `lib/env.ts` zod-validated env.

### GZW-005 · Design tokens and shared components
Status: done · Needs backend: –
- Tokens and fonts from `design-system.md`; shadcn/ui themed; `PageHeader`, `DataTable` (cursor pagination, URL filters, skeletons), `StatusPill`, `ConfirmDialog`, `ProblemAlert`, `EmptyState`, toast. Storybook not required; a `/dev/components` page (dev only) shows them.

### GZW-006 · Deployment pipeline
Status: done · Needs backend: – (the API's `CORS_ALLOWED_ORIGINS` must list `https://admin.gizetransport.com`)
- Cloudflare Workers via OpenNext; preview deploy per PR, production on `main` at `https://admin.gizetransport.com`; security headers and a nonce-based CSP (`connect-src` allows the API origin from `NEXT_PUBLIC_API_BASE_URL`, e.g. `http://localhost:8000` locally, and the Supabase project). See architecture.md, "Deployment".
- Owner decisions (2026-11-10): strict nonce CSP, so pages render per request (no cacheComponents/PPR); PR previews deploy now and load data once the API allows preview addresses.

### GZW-007 · Docs and tickets for the two customer types
Status: done · Needs backend: GZ-025
- Docs only: product brief, architecture, design system, engineering standards and these tickets, for prepaid individuals and postpaid companies, forming routes, route requests and "add a van" (backend owner decisions, GZ-025). Replaces the waitlist screens.
- Updated for `api-v2.5.0`: routes go A → B with arrival times and areas served (no pickup points), route readiness (`status_changes`) and launch months (GZ-067), picker search, the demand summary, and running against the local API with sample data (GZ-068).

---

## Build order

Screens are built in the order their backend tickets are tagged (`npm run contract:sync`), never before. Available now (latest `api-v2.20.0`): `staff_me`, staff management and audit log (`api-v1.2.0`), areas (`api-v1.3.0`), corridors (`api-v1.4.0`), companies (`api-v1.5.0`), route prices (`api-v1.6.0`), route times and areas served (`api-v2.0.0`), route status and deletion (`api-v2.1.0`), route requests and the demand summary (`api-v2.2.0`), add a van (`api-v2.3.0`), frozen corridor and school (`api-v2.4.0`), route readiness and launch months (`api-v2.5.0`), staff name corrections (`api-v2.6.0`), rider management (`api-v2.10.0`), assign rider to route (`api-v2.11.0`), seat offers (`api-v2.13.0`), drivers (`api-v2.14.0`), assign driver to route (`api-v2.15.0`), the overview summary (`api-v2.16.0`), a route's offer queue (`api-v2.18.0`), requests by area pair, requests linked to a new area, company riders on started routes only and a driver's routes (`api-v2.19.2`), riders starting soon on the overview (`api-v2.20.0`). So GZW-025, GZW-030, GZW-031, GZW-042, GZW-044, GZW-045, GZW-050, GZW-053 and GZW-070 can be built; GZW-043 waits for GZ-042 and a student's guardian for GZ-033; GZW-051 and GZW-052 are deferred with GZ-051 and GZ-052.

### Questions for the backend

Answered in `api-v2.5.0` (GZ-067): what a route still needs and when it can launch (`status_changes`, `GET /v1/routes/{route_id}/launch-months`), picker search (`/v1/routes?q=` code prefix, `/v1/companies?q=&is_active=true` name prefix), every status move through `PUT /v1/routes/{route_id}/status`, and the demand summary's shape. The tickets below use them.

Answered in `api-v2.18.0` (GZ-075): question 10, who's next for a route's seat. The portal listed a route's requests oldest first, but "Offer a free seat" skips requests with an open offer and puts those offered a seat here before last, so the dialog couldn't show the real order. `offers_queue` now lists the route's queue in the order the offer picks, with `position`, `offered_before` and `not_offerable`; GZW-044 uses it.

Answered in `api-v2.19.2` (GZ-076, GZ-077, GZ-078), all used by GZW-045:
- Question 7, requests per area pair: `route_requests_list` filters by each end (`from_area_id` or `from_area_name`, `to_area_id` or `to_area_name`, a name ignoring case; both for one end is a 422), so a Demand card opens exactly the requests it counts.
- Question 8, requests naming an area not listed yet: adding or renaming an area links the open requests that typed its name (ignoring case); closed ones keep the text, and a link that would repeat the same rider's open request or put the area at both ends is skipped. A new request typing a listed area's name gets that area (a 422 on the typed field if it is the other end's).
- Question 9, a company rider on a draft or paused route: owner decision, only their company's `active` or `paused` routes take them; a draft is a 422 on `/route_id`, like adults. Seats already on a draft are kept and can be ended; placing them back on it needs the route started first. `ROUTE_NOT_READY` (inactive company) stays only as a safety check.
- Question 11, a driver's routes: `routes_list` takes `driver_id` (any status, not deleted: the routes `DRIVER_ASSIGNED` counts).

Open (not blocking; asked 2026-11-19 for GZW-070). Each Overview count opens a list, but three lists can't show exactly the records counted, so the cards open the closest list and say which:

12. **Routes ready to launch as a list.** The Overview says "2 routes are ready to launch", but `routes_list` can't filter to them: the card opens every forming route (say 6) and staff spot the ready ones by their progress. Ask: a `routes_list` filter for "ready to launch", by the same rule as `ready_to_launch`.
13. **Active routes with no driver as a list.** "1 active route has no driver" opens every active route (say 12); staff look for "Not assigned" in the Driver column. Ask: a `routes_list` filter for "no driver", by the same rule as `active_without_driver`.
14. **Open seat offers across routes.** "3 open seat offers" can't open anything: offers are listed per route only (`GET /v1/routes/{route_id}/offers`). Ask: a list of open offers across all routes (rider, route, when it runs out), so staff can phone riders while SMS is paused (GZ-079).

Answered in `api-v2.20.0` (GZ-080): riders whose seat starts on a later day counted nowhere on the Overview. `riders.starting` counts them; riding today plus starting soon are exactly the riders list's `seat=active`, so GZW-070 opens that list for both.

Decided:

6. **Route request moves** (GZW-040): requests have no `status_changes`. Owner decision (2026-11-03): the portal offers match / fulfil / decline from the documented flow (`new` → `matched` (again) → `fulfilled`, `new` → `fulfilled`, `new`/`matched` → `declined`; fulfilled and declined are final) and explains `INVALID_STATUS_CHANGE`, reloading the request. No backend change.

---

## W1 – Sign-in and shell

### GZW-010 · Sign in and session
Status: done · Needs backend: GZ-010, GZ-011 (in `api-v1.2.0`)
- Supabase email/password sign-in, `@supabase/ssr` cookies, middleware protection, sign-out; calls `GET /v1/staff/me` (`staff_me`) – 401 goes to sign-in, 403 signs out with a clear message.
- From GZW-004: a 401 anywhere already sends the user to `/sign-in?next=<path>` (`QueryProvider`). After sign-in, follow `next` only if it starts with a single `/` (not `//` or `/\`), else go to `/`. Clear the TanStack Query cache on sign-in and sign-out so one person's data never shows for the next.

### GZW-011 · Portal shell and role-aware navigation
Status: done · Needs backend: GZ-011 (in `api-v1.2.0`)
- Sidebar (MVP items only: Overview, Routes, Route requests, Demand, Companies, Riders, Drivers; Areas and Corridors under a "Places" group; Staff and Audit log for Admin only), signed-in name, role and Sign out at the foot of the sidebar (as in `Admin.png`), drawer under 1024 px; `NoPermission` for a 403 and a 404 page.

### GZW-012 · Set a password: invitation and reset
Status: done · Needs backend: – (Supabase Auth settings, README "Supabase Auth settings"; the API's invite sends no `redirect_to`)
- Found in GZW-006: an invited staff member's email link (and a password reset) landed on the portal, which had no page to set a password.
- `/auth/confirm` is the email link's page: a **Continue** button posts the link to `/auth/verify` (same-origin only), which checks it with Supabase (`verifyOtp`, `token_hash` and `type` `invite` or `recovery`; it works once), signing the person in, then "Set your password" (`/set-password`). Opening the page uses nothing, so mail scanners that open every link don't use it up. A link that doesn't work comes back to its page, which says so (signed in or not). "Forgot your password?" (`/forgot-password`) asks Supabase for a reset link and answers the same whether or not the email has an account (a second email to a real account within a minute counts as sent; the answer never comes sooner than 1.2 s). `/auth/confirm`, `/auth/verify` and `/forgot-password` work signed out; `/set-password` needs a session. Middleware doesn't refresh any session on `/auth/verify`, so two people's cookies never mix.
- Owner decision (2026-11-10): passwords of at least 12 characters (Supabase's project setting must match), at most 72 bytes (Supabase's limit, counted as it counts). Setting a password signs out the person's other sessions, and says so if that didn't work. Known limit: a session that isn't from an email link can also change the password; Supabase's "Secure password change" makes old sessions sign in again first (README).

---

## W2 – Places, companies and routes

### GZW-026 · Areas · Needs backend: GZ-026 (in `api-v1.3.0`) · Status: done
- `areas_list` (search `q`, 1–100 characters), `areas_create` (`Idempotency-Key` per action, reused on retry), `areas_update` (rename), `areas_get`; name 1–100 characters, `AREA_NAME_TAKEN` on the name field. Admin delete (`areas_delete`): `AREA_IN_USE` explained ("a corridor, a route or an open route request uses this area"); a deleted area's name can be used again.
- Shared `AreaPicker` (searchable, keyboard-accessible combobox over the areas list) used by corridors, areas served and route requests.

### GZW-020 · Corridors · Needs backend: GZ-020 (in `api-v1.4.0`), GZ-021 · Status: done
- `corridors_list` shows "origin → destination" with area names from the response; filters by origin and/or destination area (two area pickers, kept in the URL). Create (`Idempotency-Key`) and edit with two area pickers; an unknown area is a field error; `CORRIDOR_EXISTS` explained. Corridors have a direction: the way back (B → A) is a separate corridor, so the UI always shows the arrow.
- Changing a corridor's areas or deleting it is refused while a live route uses it (`CORRIDOR_IN_USE`, explained). Admin delete with confirmation. No threshold.

### GZW-029 · Companies · Needs backend: GZ-029 (in `api-v1.5.0`) · Status: done
- `companies_list` (search `q`: names starting with the text, ignoring case; active filter `is_active`), `companies_get` with the company's routes (`routes_list?company_id=`), `companies_create` (`Idempotency-Key`; name, contact name, phone and email required; notes optional; billing `postpaid` shown read-only), `companies_update` (fields, and `is_active` to deactivate or reactivate). Errors: `COMPANY_NAME_TAKEN` on the name field, `COMPANY_IN_USE` (deactivating while one of its routes is active or paused; deleting while it has a route). Admin delete.
- Shared `CompanyPicker` (`is_active=true`) for corporate routes. Contact name, phone and email are personal data: never in URLs, logs or Sentry. Phones may be typed any usual way; the API stores `+2519…`/`+2517…`.

### GZW-021 · Routes list and detail · Needs backend: GZ-021, GZ-023 (in `api-v2.0.0`) · Status: done
- `routes_list` filters: search by code (`q`, codes starting with the text), type, status, corridor, company. Columns: code + corridor ("A → B"), type (school or company), times, seats taken/free this month and next (`seats_taken`/`seats_free`, busiest day), status with launch progress for forming routes (`reserved` of `launch_minimum`: "9 of 12").
- Times are four, in order: leaves A (`morning_time`), arrives at B (`morning_arrival_time`), leaves B (`return_time`), arrives at A (`return_arrival_time`), shown as sent. Routes made before arrival times existed show them as "Not set"; editing them needs both at once.
- Detail (side panel ≥ 1280 px, page otherwise) per the routes mockup: corridor, areas served in order, times, seats, prices (GZW-022), status actions (GZW-024), "copied from" (a deleted original shows as deleted, not an error). Shared `RoutePicker` (search by code) for requests and riders.
- Create (`Idempotency-Key`) and edit: code (2–20, letters, digits, hyphens), corridor picker, type (fixed after creation) deciding school name (`student`) or company picker (`corporate`, active companies only), the four times, seats 1–60, launch minimum (`public`/`student` only, 1 to seats). Errors: `ROUTE_CODE_TAKEN`, `SEATS_BELOW_TAKEN`, `SEATS_BELOW_LAUNCH_MINIMUM`, `ROUTE_HAS_RIDERS`, `ROUTE_HAS_PRICES` and `ROUTE_HAS_REQUESTS` (corridor and school are fixed once the route has prices or open requests: "add a new route to serve somewhere else"); times out of order and a corridor change while areas are served are field errors.

### GZW-022 · Route prices (admin) · Needs backend: GZ-022 (in `api-v1.6.0`) · Status: done
- `routes_set_prices` (admin): round trip and one-way required, Saturday add-on optional (`public` only), whole birr 1–100,000, all sent at once. Staff see prices read-only; unset prices show "Not set". Corporate routes (`prices` null) show "Rate agreed with the company" and no price form (`ROUTE_HAS_NO_PRICES` handled anyway).

### GZW-023 · Areas served · Needs backend: GZ-023 (in `api-v2.0.0`), GZ-026 · Status: done
- On route detail: the areas a route passes between A and B, in order, no times (replaces pickup points, owner decision 2026-10-31). Edit as one list – add with the area picker, remove, reorder (keyboard-accessible: move up / move down buttons) – saved with `routes_set_areas` (whole list, staff). Not A or B, each area once, at most 20: field errors from the API shown on the list. Shown as "A → CMC → Megenagna → B".

### GZW-024 · Route status and deletion · Needs backend: GZ-024 (in `api-v2.1.0`), GZ-067 (in `api-v2.5.0`) · Status: done
- Actions come from the route's `status_changes` (the moves its type allows from its status): one button per move, enabled only when `ready` (except Launch: owner decision 2026-11-03, it also opens when riders are the only blocker, since the API judges a launch for the earliest month and a later month may be ready – the dialog's month list decides), otherwise disabled with its `blocked_by` reasons shown next to it (`PRICES_MISSING`: "an admin must set the round-trip and one-way prices"; `COMPANY_INACTIVE`; `ROUTE_HAS_RIDERS`: "someone is reserved"; `NOT_ENOUGH_RIDERS` with `reserved` of `launch_minimum`). The UI never works these out itself. Labels by move: draft → forming "Start forming", forming → draft "Back to draft", forming → active "Launch", draft → active (corporate) "Start service", active → paused "Pause", paused → active "Resume".
- Every move is `routes_set_status` (`PUT`, `{status}`), through ConfirmDialog. Launch: a dialog lists `routes_launch_months` (the 1st of each month up to a year ahead, riders reserved for each, `ready`); staff pick a ready month (default the change's `launch_date`) and send `{status: "active", launch_date}`. A launch for a later month makes the route active at once, riders starting that day – say so in the dialog.
- Readiness is a snapshot: a 409 (`ROUTE_NOT_READY`, `NOT_ENOUGH_RIDERS`, `ROUTE_HAS_RIDERS`, `INVALID_STATUS_CHANGE`) shows the message in the dialog and reloads the route. Each change's response is the updated route.
- Admin delete with confirmation (`ROUTE_HAS_RIDERS`, `ROUTE_HAS_REQUESTS` explained).

### GZW-028 · Add a van · Needs backend: GZ-028 (in `api-v2.3.0`) · Status: done
- From route detail: `routes_copy` (`Idempotency-Key`) with new code, seats and launch minimum (individual routes); it copies corridor, type, school or company, times, areas served and prices (unchanged). The result says whether the copy starts `forming` or `draft` and opens it. Errors: `ROUTE_CODE_TAKEN`, `ROUTE_NOT_READY` (a corporate route's company is inactive).

### GZW-025 · Launch messages · Needs backend: GZ-041 (in `api-v2.12.0`) · Status: done
- Found in GZW-042: when a route launches, the API texts every rider on it in the background (`routes_launch_messages`: each message sent, failed, pending or unconfirmed) and staff retry what failed (`routes_retry_launch_messages`, Idempotency-Key, 202). On the route's page after a launch: who was texted and how it went (no phone numbers), and a Retry for failed or pending ones; a message sending right now, or unconfirmed, is never resent (the API decides). Company routes send none.
- Built (owner decisions 2026-11-12): a "Launch messages" section on a launched public or student route (running or paused), under Status: when it launched, how many riders and how their texts went (only counts above 0), and each rider (their name opens them; no phone numbers), their first day, the text's state (sent, sending, may have arrived with "call them if unsure", not delivered, not sent yet) and tries when more than one. "Send again (n)" for the not delivered and not sent yet, confirmed first (texts cost money), one Idempotency-Key per confirmation. The list reloads every 3 seconds while a text is sending; for a minute after a launch made on that page while any is not sent yet; and for a minute after a resend while any is not delivered or not sent yet (timed by the browser's own clock; never forever: a restart midway leaves texts not sent yet until staff send them again). A failed read stops it until Retry, so a 429's Retry-After is respected. When nothing is left to send, focus on "Send again" moves to the summary, which is read out as it changes.

---

## W3 – Riders

### GZW-030 · Riders list and detail · Needs backend: GZ-034 (in `api-v2.10.0`), GZ-035 (in `api-v2.11.0`) · Status: done
- Search, filters (type, status, route), detail with guardian/children or company, edit, admin delete.
- Built (owner decisions 2026-11-11): `riders_list` newest first with type, seat (riding, reserved, none) and route filters in the URL. One "Name or phone" box: letters search names (`q`), a whole Ethiopian mobile is looked up with `riders_lookup` (a POST), digits short of a number ask for the whole number. What's typed stays on the page, never in its address or storage. Phones show masked in the list and in full only on the detail.
- Detail (side panel ≥ 1280 px, page otherwise): phone, company (linked), where they board and go, plan and Saturday add-on, open requests, how they joined, the seat held (riding or reserved, from/until) and a move to come (`next_seat`).
- Record a rider here (owner decision): an adult from a phone call (where they board and go, plan, Saturday) or a company rider (company, where they board). `RIDER_EXISTS` links to the rider who has the phone; a phone search that finds nobody offers to record them with it. Edit sends only what changed; a seat holder's change that doesn't fit their route is explained on its field. Admin delete is refused while they hold a seat (`RIDER_HAS_SEAT`).
- Not yet: a student's guardian and children (GZ-033 not built: students show as "Student"); payments, trips and complaints from the mockup (no API). Placing, moving and ending seats is GZW-031.

### GZW-031 · Assign rider to route · Needs backend: GZ-035 (in `api-v2.11.0`) · Status: done
- Dialog: route → boarding area (A or an area served) → plan → Saturday add-on; scope confirmed when GZ-035's contract is tagged. Individual riders start on the 1st of a month (reservation on a forming route, place on an active one) and leave at a month's end; company riders (recorded by staff: name, phone, company) start and stop on any day. A skip reason is required when the API reports older open requests for the route. `ROUTE_FULL` explained with an offer to record a route request; rule violations explained; idempotent.
- Built (owner decisions 2026-11-11): the API takes where they board and go, their plan and Saturday from the rider (`riders_place` sends only the route, the start and a skip reason), so the dialog asks which route and from when; to change the trip, staff edit the rider first. Adults choose from the routes that take their trip (`public_routes_list`, the list the rider app shows: code, A → B, times, forming or running, full) and a start month (the next 1st up to a year ahead); company riders from their company's routes and a start day (today by default). Moving excludes their current route and says the old seat ends the day before. `ROUTE_HAS_WAITING_REQUESTS` asks for a reason and sends again; `ROUTE_FULL` on a running route offers a route request filled in with the route and the rider; `ROUTE_NOT_READY` names the inactive company; a 422 on `route_id`/`start_date` is explained on its field.
- End seat: an adult at a month's end (this month's by default), a company rider any day; a reservation, a seat not started or a move to come ends at once. "Keep on R-03" (shown while a seat is ending or a move is planned) places them back on their route, which undoes the end and cancels the move.

---

## W4 – Route requests and demand

### GZW-040 · Route requests · Needs backend: GZ-027 (in `api-v2.2.0`) · Status: done
- `route_requests_list` (oldest first) with filters status, kind, open, route (route picker); no search by phone or name (phones never go in URLs). Detail with the request's areas or route, matched route, decline reason, source (`staff`, set by the API).
- Record a request from a phone call (`route_requests_create`, `Idempotency-Key`): kind *new areas* (each end an area picker, or a name for an area not listed yet; ends different) or *a specific route* (route picker over running routes); rider type (adult/student), rider name, school (students), preferred morning and return times (optional), contact name and phone (a student's parent or guardian), notes. `ROUTE_REQUEST_EXISTS` points to the open request. Edit who and when only (`route_requests_update`); what is asked for doesn't change.
- Actions (`route_requests_set_status`): match to a route (route picker), mark fulfilled, decline with a reason (1–100 characters); `INVALID_STATUS_CHANGE` explained (see question 6). Admin delete. Contact and rider names and phones are personal data: never in URLs, logs or Sentry.

### GZW-041 · Demand · Needs backend: GZ-027 (in `api-v2.2.0`) · Status: done
- `route_requests_summary`, two lists, busiest first, at most 100 each: **area pairs** (open new-areas requests not matched yet, between areas no route serves yet: listed area or a name not listed yet at each end, and the count) and **routes** (open requests waiting for a route, its status and `seats_free_next_month`). When a list is cut (`*_truncated`), say "Showing the 100 busiest".
- From an area pair: open its requests; when both ends are listed areas, offer "Add corridor" or "Add route" prefilled; a name not listed yet offers "Add area" first (with GZW-045). From a route: open it, or add a van (GZW-028). Card layout from `AdminWaitlists.png`, brand colours.

### GZW-042 · Seat offers and skips · Needs backend: GZ-040 (in `api-v2.13.0`) · Status: done
- Free seats offered to the oldest open request, offer status and expiry; skipping a request needs a reason (audited). Scope confirmed when GZ-040's contract is tagged.
- Built (owner decisions 2026-11-11): a "Seat offers" section on a public route's page. The route's offers newest first (`offers_list`): who asked (their request), the seat's month, open until when (Addis time), accepted (their rider), expired or withdrawn, the text message (sent, sending, not delivered: call them) and any skip reason. "Offer a free seat" (`offers_create`, Idempotency-Key): to whoever has waited longest (the API picks), or a request chosen from the adults waiting for the route, which needs a reason when older ones wait (`ROUTE_HAS_WAITING_REQUESTS`; the queue's order and the reason asked up front came with GZW-044); a running route's seat from a chosen 1st, a forming route's a reservation from the next 1st. Refusals explained (`ROUTE_FULL`, `NO_WAITING_REQUESTS`, `OFFER_OPEN`, `ROUTE_NOT_READY`, a request that no longer waits). An open offer: Accept for them (`offers_accept`, when they said yes on the phone; `RIDER_HAS_SEAT` → move them in Riders, `RIDER_EXISTS`, `OFFER_CLOSED`) or Withdraw (`offers_withdraw`).
- Not here: a request's offers on its own page (the API lists offers by route only).

### GZW-043 · Company days without service · Needs backend: GZ-042 · Status: todo
- Record and list dates a company's route does not run (date, reason, who asked), per route and company. Scope confirmed when GZ-042's contract is tagged.

### GZW-044 · Offer queue order · Needs backend: GZ-075 (in `api-v2.18.0`) · Status: done
- The offer dialog shows the route's queue (`offers_queue`) in the order "Offer a free seat" picks, in place of the requests oldest first and the portal's own guesses from the route's offers (backend question 10).
- Built (owner decision 2026-11-12): "Next in line" names position 1 (who, when they asked, offered here before) and still lets the API pick when it's sent. The others are numbered from 2 and need a reason, asked for as soon as one is chosen. Requests that can't be offered (an open offer anywhere, or a student's) are listed last with why and can't be chosen. "Show more of the queue" loads the next page; positions continue and a request read twice shows once. A refusal reloads the queue: a chosen request that has left it asks staff to choose again, and one that is now first becomes next in line. Each opening reads the queue afresh (never an earlier opening's order).

### GZW-045 · Backend answers 7, 8, 9 and 11 · Needs backend: GZ-076, GZ-077, GZ-078 (in `api-v2.19.2`) · Status: done
- Owner decision (2026-11-18): one ticket for the four answers.
- Demand (questions 7 and 8): an area pair's card opens exactly the requests it counts ("See these requests": `kind=new_areas&status=new` and each end's `*_area_id` or `*_area_name` in the address; a typed name is a place, not personal data). Route requests shows that pair ("From Ayat to Lebu (not listed)") with "Show all areas"; no picker for it. A card with a name not listed yet offers "Add area Lebu", the area form filled in; once saved, the requests name the area, the summary is read again and the card, now under the area, offers the corridor or route and takes focus. Adding or renaming an area anywhere reads route requests and Demand again. Recording a request: a typed name that is the listed area at the other end is refused on its field, before sending and from the API.
- Company seats (question 9): a company's draft route is listed as "Not started" and can't be chosen; "Keep on R-21" for a seat on a route back in draft explains that it must be started first.
- Drivers (question 11): a driver's details list their routes (`routes_list` by `driver_id`: code linked, status). Deactivate and Delete refused with `DRIVER_ASSIGNED` read their routes again and name them ("They drive B-07 and R-21…"), each with a link to it.

---

## W5 – Drivers

### GZW-050 · Drivers · Needs backend: GZ-050 (in `api-v2.14.0`) · Status: done
- Rescoped (owner decision 2026-11-05, GZ-050): basic information only in the MVP: full name, phone, address and the plate of the van they drive; a driver is active or inactive. No applications, documents, inspection or approval (GZW-051, GZW-052 deferred); `AdminDrivers.png` shows the later design.
- Built (owner decisions 2026-11-12): Drivers in the navigation. The list newest first (`drivers_list`): name, plate, phone, status, added; a status filter (in the address) and one search box for the start of a name or plate (`q`, plates in any case), kept on the page and never in its address (a name is personal data; the address only says `searched=1`). A driver's details (`drivers_get`) as their own page or, from 1280 px, beside the list: phone, plate, address, status, added and last changed. Add and edit (`drivers_create` with an Idempotency-Key, `drivers_update` with only what changed: a phone or plate written another way is no change); `DRIVER_EXISTS` on the phone field, `PLATE_TAKEN` on the plate, a refused plate explains the API's rule. Deactivate and reactivate (confirmed), Delete for admins (confirmed); `DRIVER_ASSIGNED` explained. Toasts never name the driver. Audit log: driver entries named and linked, `route.driver_changed` named.

### GZW-051 · Driver documents · Needs backend: GZ-051 · Status: deferred (owner decision 2026-11-05: not in the MVP)
Upload via signed URLs (type/size checked first, progress), view via short-lived links.

### GZW-052 · Inspection and approval · Needs backend: GZ-052 · Status: deferred (owner decision 2026-11-05: not in the MVP)
Record inspection; approve/reject enabled only when the API allows; missing requirements listed.

### GZW-053 · Assign driver to route · Needs backend: GZ-053 (in `api-v2.15.0`) · Status: done
- From route detail; only eligible drivers offered; API errors explained. Rescoped with GZ-053 (owner decision 2026-11-05): only active drivers; one driver per route; a driver may drive several routes whose runs don't overlap (the API decides: `DRIVER_BUSY`).
- Built (owner decisions 2026-11-12): "Driver" in a route's facts (any type or status): their name (their page) and plate, or none yet. "Choose driver" / "Change driver" (`routes_set_driver`, a PUT): a driver picker offering active drivers by the start of a name or plate ("Name · Plate"); `DRIVER_BUSY` on the picker, naming the driver; a driver deactivated or deleted meanwhile (422 on `driver_id`) clears the choice and the picker searches afresh. "Remove driver", confirmed. Routes list: a Driver column. Editing a route: new times that clash with another route of its driver explained (`DRIVER_BUSY`). Toasts never name the driver. A driver's own routes came with GZW-045.

---

## W6 – Admin tools

### GZW-060 · Staff accounts · Needs backend: GZ-013 (in `api-v1.2.0`), GZ-069 (in `api-v2.6.0`) · Status: done
- List, detail, invite (`email`, `full_name`, `role`; `Idempotency-Key` per action, reused on retry), change role, deactivate and reactivate (`PATCH` with `role` and/or `is_active`). "Pending" while `first_signed_in_at` is null. Errors: `LAST_ACTIVE_ADMIN`, `STAFF_EMAIL_TAKEN` (offer to reactivate the existing person), `AUTH_ACCOUNT_EXISTS`; field errors mapped from `errors[].field` (`/email`).

### GZW-061 · Audit log · Needs backend: GZ-012 (in `api-v1.2.0`) · Status: done
- Newest first; filter by entity (`entity_type` + `entity_id` together) or by actor (`actor_staff_id`); before/after view showing `"[redacted]"` values as redacted, not as data.

---

## W7 – Release

### GZW-070 · Overview page · Needs backend: GZ-064, GZ-080 (in `api-v2.20.0`) · Status: done
Counts and "needs action" items from the summary endpoint only.
- Built: `overview_get` only, read each time the page is opened or its tab comes back (no polling); the heading dates it with the API's day ("Thursday, November 19"). Only widgets the API backs: the mockup's map, backups, payments and complaints are not in the MVP.
- Needs action (sun cards, only while above 0, "Nothing needs action right now." otherwise): routes ready to launch ("See forming routes"), active routes with no driver ("See active routes"), open route requests ("See open requests", "See demand"). The first two open the closest list until backend questions 12 and 13 are answered.
- Counts, each a link to its filtered list where one holds exactly them: routes by status; riders riding today, starting soon (GZ-080), reserved (`seat=reserved`) and all, with "See riders with a seat" (`seat=active`: riding today and starting soon together); open seat offers (no link: question 14); active drivers (`is_active=true`).

### GZW-073 · Sidebar icons and groups · Needs backend: GZ-064 (in `api-v2.16.0`) · Status: done
Visual refresh, part 1 of 3 (owner request 2026-11-19, inspired by a dashboard shot, not copied; brand colours unchanged).
- Built: an icon before every item (for sight only); headings Operations (Routes, Route requests, Demand), People (Companies, Riders, Drivers), Places and Admin (admins only), each a labelled list; Overview on its own at the top.
- A sun count beside Route requests: the open route requests from `overview_get` (the link is described by it, "6 open"; "99+" above 99; none at 0 or after a failed read). It shares the overview's cache: read again once a minute while the tab is visible, when the tab comes back (not before a 429's `Retry-After` is over), and at once after a change that can open or close a request (route requests, seats, offers).
- The account at the foot is a card: initials (`Avatar`, `src/components/avatar.tsx`), name, role pill and Sign out with an icon. Same in the phone drawer.

### GZW-074 · Tables · Needs backend: none · Status: done
Visual refresh, part 2, every list at once (Routes, Route requests, Companies, Riders, Drivers, Areas, Corridors, Staff, Audit log).
- Built: DataTable `toolbar` – each screen's search and filters in the card's top bar, in every state and never remounted (Riders' partly typed phone now shows through the table's empty state, keeping the search box). Header row on `canvas`, uppercase by CSS; roomier rows, lighter dividers, equal-width digits; a light shadow on the card.
- Row pictures via `CellWithPicture`: initials (`Avatar`) for people, an icon tile (`IconAvatar`) for companies, areas and corridors (not Routes: it is the widest list, and Status must stay in view at 1440 px); hidden on phones. Audit log keeps the date first.
- StatusPill gains a dot (every pill in the portal). No row count: lists have no total.

### GZW-075 · Overview cards and charts · Needs backend: none · Status: done
Visual refresh, part 3, from `overview_get` only (nothing new asked of the API).
- Built: Needs action as rows in one card (sun icon tile, title, hint, links on the right from md, under the text on phones). Routes and Riders as cards side by side from 1280 px, Seat offers and drivers below; each card has an icon heading and its counts split by dividers; Routes links "All routes".
- Charts (SVG, widths as attributes rather than style attributes): routes by status as one bar, described in words for screen readers and keyed by a dot on each tile; each rider count's share of all riders as a thin bar for sight only. No chart over time (the API gives today's counts only).

### GZW-076 · Compact list toolbar · Needs backend: none · Status: done
Owner feedback 2026-11-20 on the Routes filters ("too much button noise, placement and alignment issues"), with Nextcloud's files toolbar as the reference for placement and space.
- Built: every list's search, filters, Clear filters and main action in one toolbar row (`ListToolbar`); chips replaced by `FilterMenu` dropdowns showing the choice ("Status: Forming"); pickers and the corridor pair as compact buttons (`toolbarLabel`, `CorridorField toolbar`); search hints shown under the box while it has focus. Page headers on lists are now just the title and description. Same URL params as before, so links and Back are unchanged. `FilterChips` removed.

### GZW-077 · Detail header and actions menu · Needs backend: none · Status: done
Owner feedback 2026-11-20: a route's details are long, and Edit, Add a van and Delete sat at the very bottom (the route panel was about two screens tall at 1440 × 900).
- Built: one header for all six details (`DetailHeader`): "← All …" on a page, then a row pinned to the top while the record scrolls (name, status, Edit, the "⋯" menu and in a panel the close button), then a summary line. `ActionsMenu` holds the record's other actions (Add a van, Deactivate, Make admin/staff, Copy link; Delete in red after a divider, admins only); an item's action runs once the menu has closed, so its dialog returns focus to "⋯". An inactive company, driver or staff member shows Reactivate beside Edit; when it goes away focus moves to "⋯". Seat, status and driver actions stay beside what they change. The rider's "holds a seat" note moved into the delete confirmation; company and driver status moved from the facts to the header.

### GZW-078 · Route detail tabs and summary tiles · Needs backend: none · Status: done
The route detail fits one screen (the side panel's Details tab fits a 1440 × 900 window with no scrolling).
- Built: tiles under the header, at a glance: seats this month and next ("9 of 14 taken", "5 free"); riders to launch while forming (the launch progress meter); the driver, with Choose/Change/Remove right there.
- Then tabs (`DetailTabs`, Radix Tabs):
  - Details: a Schedule card with the runs, school or company, the launch minimum once not forming, and copied-from; Areas served and Prices cards, each with its edit button in its heading (`DetailCard`).
  - Status and launch: the moves with their reasons, and the launch texts; a "Ready" badge when the API says the launch is ready.
  - Seat offers: public routes only.
- The tab is kept in the address (`?tab=status|offers`, replacing the entry). An unknown or unavailable value shows Details. The tab is kept when another route opens in the panel, cleared when the panel closes, and carried to the route's page on a narrow screen (`useDetailPanel` `recordParams`). Every tab stays mounted (hidden when not shown), so launch texts keep being watched.

### GZW-071 · Full regression and accessibility pass · Needs backend: all above · Status: todo
Playwright suite for every MVP flow against staging; axe clean; Lighthouse targets met.

### GZW-072 · Production launch · Needs backend: GZ-062 · Status: todo
Production env vars, domain (e.g. `admin.gizetransport.com`), CSP verified, runbook section for the portal.
