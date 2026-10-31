# Product brief – Gize Admin Portal

Gize Transport sells monthly minibus subscriptions in Addis Ababa. A route takes riders from one area to another (A → B, its corridor) within set times; riders board at A or in an area the route passes (its **areas served**). The admin portal is the internal tool Gize's team uses every day to run routes, companies, route requests, riders and drivers. Full business rules live in the backend repo's `docs/product-brief.md` (two customer types: owner decision GZ-025); this file covers what the portal must show and let people do. The portal never enforces these rules itself – it shows what the API returns and explains the API's refusals.

## Users

- **Staff** – operations team; daily work on routes and the areas they serve, areas, corridors, companies, route requests, riders and drivers; moves routes through their statuses and adds vans.
- **Admin** – everything Staff can do, plus prices, deletions, staff accounts and the audit log.

Typical use: a laptop in the office, sometimes a phone in the field. Must work well at 1280–1440 px and remain usable at 375 px. Connections can be slow.

UI language: **English** for now, with every string in `messages/en.json` so Amharic can be added later. Data (place names, rider names) may be in Amharic script and must render correctly (Noto Sans Ethiopic in the font stack).

## Two kinds of customer

|  | Individual riders | Companies |
| --- | --- | --- |
| Route types | `public` (adults), `student` (one school) | `corporate` (one company's own route) |
| Payment | Prepaid monthly | Postpaid, billed afterwards |
| Join and leave | From the 1st of a month; leave at a month's end | Any day; Gize staff record company riders |
| Route start | `forming`: collects sign-ups until the route's **launch minimum**, then staff launch it | Starts from the agreement with the company |
| Prices on the route | Round trip, one-way, Saturday add-on (`public` only, optional) | None – show "Rate agreed with the company" |

**Route status:** individual routes `draft → forming → active ⇄ paused` (and `forming → draft` while nobody is reserved); corporate routes `draft → active ⇄ paused`. Every route tells the portal which moves it allows now and what blocks the others (`status_changes`), so the portal never works the rules out. A route's corridor and school are fixed once it has prices or open route requests – to serve somewhere else, Gize adds a route. Admin deletes a route only while nobody is reserved or riding and no open request names it.

**There is no waitlist.** Unmet demand is a **route request** – *new areas* (no route serves those areas yet) or *a specific route* (usually full). Requests are `new`, then `matched` to a route, `fulfilled` once the person has a place, or `declined` with a reason. Staff decide where the next route or van goes from the demand per area pair and per route, next to free seats. A full route gets another van: **add a van** copies the route under a new code with its own seats. A freed seat stays empty until the next month, then goes to the oldest open request for that route (seat offers and skipping come with the riders and M4 work).

**Times:** a route has four schedule times, in order – the morning run leaves A and arrives at B, the evening run leaves B and arrives at A. There are no stops with their own times (owner decision, 2026-10-31). Schedule times are local Addis Ababa `"HH:MM"` and are shown exactly as the API sends them. Timestamps (`created_at`, …) are ISO 8601 UTC and displayed in Africa/Addis_Ababa.

## Screens (MVP)

| Screen | Staff | Admin | Mockup |
| --- | --- | --- | --- |
| Sign in (email + password via Supabase) | ✓ | ✓ | – (design from the design system) |
| Overview: counts and items needing action that the API provides | ✓ | ✓ | `Admin.png` (only widgets backed by endpoints) |
| Areas (list, search, add, rename) | ✓ | ✓ + delete | – (list pattern) |
| Corridors (origin area → destination area; the way back is its own corridor) | ✓ | ✓ + delete | – (list pattern) |
| Companies (contact person, active/inactive, their routes) | ✓ | ✓ + delete | – (list + detail pattern) |
| Routes list + detail: status, launch progress, seats this month and next, areas served, times, driver | ✓ | ✓ + delete | `AdminRoutes.png` |
| Route prices (individual routes only) | view | edit | `AdminRoutes.png` (price field) |
| Route status actions: start forming, back to draft, launch, pause, resume; add a van | ✓ | ✓ | `AdminRoutes.png` (detail actions) |
| Route requests: list, record, match, fulfil, decline | ✓ | ✓ + delete | `AdminRiders.png` (list + detail pattern) |
| Demand: open requests per area pair and per route, next to free seats | ✓ | ✓ | `AdminWaitlists.png` (card layout only) |
| Riders list (search, filters) + rider detail + assign to route | ✓ | ✓ + delete | `AdminRiders.png` |
| Drivers: applications, documents, inspection, approval | ✓ | ✓ | `AdminDrivers.png` |
| Staff accounts (invite, role, deactivate) | – | ✓ | – |
| Audit log | – | ✓ | – |

Delete buttons appear for Admin only. Mockups also show later features (live map, payments, schools, complaints, payouts, reports, backup vans); **do not build those now** and do not show their navigation items.

## Key interactions

- **Pickers, not free text:** areas, corridors, companies and routes are always chosen from the API's lists (searchable pickers). The only free text for a place is a route request for an area that isn't listed yet.
- **Status actions:** each move the route allows is a button, enabled only when the API says it is ready; otherwise the API's reasons are shown next to it (prices missing, company inactive, someone reserved, not enough riders). Readiness is a snapshot: if the API still refuses, show its message and reload the route.
- **Launch (forming → active):** staff pick a launch month from the API's list (the 1st of each month up to a year ahead, with the riders reserved for each and whether it is ready) and see launch progress ("9 of 12 needed"). A launch for a later month makes the route active at once.
- **Add a van:** from a route's detail; new code, seats and launch minimum (times, areas served and prices are copied); the result says whether the copy starts as `forming` or `draft` and links to it.
- **Record a route request:** from a phone call – kind (new areas or a specific route), rider type and name, contact details; `ROUTE_REQUEST_EXISTS` points to the existing open request.
- **Assign rider to route:** pick route + boarding area (A or an area served) + plan; individual riders start on the 1st of a month (a reservation on a forming route, a place on an active one), company riders any day. If the API returns `ROUTE_FULL`, explain it, keep the form filled and offer to record a route request.
- **Driver approval:** only enabled when the API says required documents and a passed inspection exist; show what's missing otherwise.
- **Staff accounts:** an invited person shows as "Pending" until they first sign in; `LAST_ACTIVE_ADMIN` and `STAFF_EMAIL_TAKEN` (offer to reactivate) are explained.
- Tables are cursor-paginated ("Next page" / "First page"), filterable, and keep filters in the URL so links can be shared.
