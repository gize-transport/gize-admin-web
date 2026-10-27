# Product brief – Gize Admin Portal

Gize Transport sells monthly minibus subscriptions in Addis Ababa. Riders board at fixed pickup points along a corridor. The admin portal is the internal tool Gize's team uses every day to run routes, riders, waitlists and drivers. Full business rules live in the backend repo's `docs/product-brief.md`; this file covers what the portal must show and let people do.

## Users

- **Staff** – operations team; daily work on routes, riders, waitlists and drivers.
- **Admin** – everything Staff can do, plus prices, deletions, staff accounts and the audit log.

Typical use: a laptop in the office, sometimes a phone in the field. Must work well at 1280–1440 px and remain usable at 375 px. Connections can be slow.

UI language: **English** for now, with every string in `messages/en.json` so Amharic can be added later. Data (place names, rider names) may be in Amharic script and must render correctly (Noto Sans Ethiopic in the font stack).

## Screens (MVP)

| Screen | Staff | Admin | Mockup |
| --- | --- | --- | --- |
| Sign in (email + password via Supabase) | ✓ | ✓ | – (design from the design system) |
| Overview: counts and items needing action that the API provides | ✓ | ✓ | `Admin.png` (only widgets backed by endpoints) |
| Routes list + route detail (pickup points, times, seats, driver) | ✓ | ✓ | `AdminRoutes.png` |
| Route prices | view | edit | `AdminRoutes.png` (price field) |
| Corridors (used by routes and waitlists) | ✓ | ✓ | – |
| Riders list (search, filters) + rider detail + assign to route | ✓ | ✓ | `AdminRiders.png` |
| Waitlists per corridor + open route from waitlist | ✓ | ✓ | `AdminWaitlists.png` |
| Drivers: applications, documents, inspection, approval | ✓ | ✓ | `AdminDrivers.png` |
| Staff accounts (invite, role, deactivate) | – | ✓ | – |
| Audit log | – | ✓ | – |

Delete buttons appear for Admin only. Mockups also show later features (live map, payments, schools, complaints, payouts, reports); **do not build those now** and do not show their navigation items.

## Key interactions

- **Assign rider to route:** pick route + pickup point + plan; if the API returns `ROUTE_FULL`, explain and keep the form filled.
- **Open route from waitlist:** confirmation dialog summarising how many riders will be assigned and notified; one idempotent request.
- **Driver approval:** only enabled when the API says required documents and a passed inspection exist; show what's missing otherwise.
- Tables are cursor-paginated ("Load more" / next page), filterable, and keep filters in the URL so links can be shared.
