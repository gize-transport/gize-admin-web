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
Status: todo · Needs backend: GZ-015
- `scripts/contract-sync.mjs`: downloads `openapi.json` and `docs/api-contract.md` from `gize-admin-api` at a tag (default latest `api-v*`) via `gh`; writes `src/lib/api/openapi.json`, regenerates `schema.d.ts` (openapi-typescript), writes `CONTRACT_VERSION`, copies `api-contract.md` to `docs/`.
- CI: regenerate and fail on any diff. Scheduled daily job: if a newer `api-v*` tag exists, open an issue with the `oasdiff changelog`.
- Acceptance: editing `schema.d.ts` by hand fails CI.

### GZW-004 · API client and error handling
Status: todo · Needs backend: GZ-015
- `lib/api/client.ts` (openapi-fetch, base URL from env, bearer token from Supabase session, `Idempotency-Key` helper, request ID capture), problem+json parsing, `errors.ts` exhaustive code map, TanStack Query provider with retry rules, 429 handling.
- `lib/env.ts` zod-validated env.

### GZW-005 · Design tokens and shared components
Status: todo · Needs backend: –
- Tokens and fonts from `design-system.md`; shadcn/ui themed; `PageHeader`, `DataTable` (cursor pagination, URL filters, skeletons), `StatusPill`, `ConfirmDialog`, `ProblemAlert`, `EmptyState`, toast. Storybook not required; a `/dev/components` page (dev only) shows them.

### GZW-006 · Deployment pipeline
Status: todo · Needs backend: –
- Cloudflare Workers via OpenNext; preview deploy per PR, production on `main`; security headers and CSP.

---

## W1 – Sign-in and shell

### GZW-010 · Sign in and session
Status: todo · Needs backend: GZ-010, GZ-011
- Supabase email/password sign-in, `@supabase/ssr` cookies, middleware protection, sign-out; calls `GET /v1/staff/me` – 403 signs out with a clear message.

### GZW-011 · Portal shell and role-aware navigation
Status: todo · Needs backend: GZ-011
- Sidebar (MVP items only), header with user and role, responsive drawer; admin-only items hidden for Staff; 403 and 404 pages.

---

## W2 – Routes

### GZW-020 · Corridors · Needs backend: GZ-020 · Status: todo
List, create, edit (incl. waitlist threshold); admin delete.

### GZW-021 · Routes list and detail · Needs backend: GZ-021 · Status: todo
Filters (type, status, corridor), seats taken/available, detail panel per mockup; create and edit route.

### GZW-022 · Route prices (admin) · Needs backend: GZ-022 · Status: todo
Admin edits prices; Staff sees read-only; Saturday price only for public routes.

### GZW-023 · Pickup points · Needs backend: GZ-023 · Status: todo
Add, edit, remove, reorder (keyboard-accessible reordering).

### GZW-024 · Route status and deletion · Needs backend: GZ-024 · Status: todo
Activate/pause; admin delete with confirmation; show API reason when blocked.

---

## W3 – Riders

### GZW-030 · Riders list and detail · Needs backend: GZ-034 · Status: todo
Search, filters (type, status, route), detail with guardian/children, edit, admin delete.

### GZW-031 · Assign rider to route · Needs backend: GZ-035 · Status: todo
Dialog: route → pickup point → plan → Saturday add-on; `ROUTE_FULL` and rule violations explained; idempotent.

---

## W4 – Waitlists

### GZW-040 · Waitlists overview and entries · Needs backend: GZ-040 · Status: todo
Per-corridor progress vs threshold, "ready" highlighting, entries list, withdraw.

### GZW-041 · Open route from waitlist · Needs backend: GZ-041 · Status: todo
Confirmation dialog with counts; one idempotent request; result summary (assigned, notified, left waiting).

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

### GZW-060 · Staff accounts · Needs backend: GZ-013 · Status: todo
Invite, change role, deactivate; last-admin protection message from API.

### GZW-061 · Audit log · Needs backend: GZ-012 · Status: todo
Filter by entity and actor; before/after view.

---

## W7 – Release

### GZW-070 · Overview page · Needs backend: GZ-064 · Status: todo
Counts and "needs action" items from the summary endpoint only.

### GZW-071 · Full regression and accessibility pass · Needs backend: all above · Status: todo
Playwright suite for every MVP flow against staging; axe clean; Lighthouse targets met.

### GZW-072 · Production launch · Needs backend: GZ-062 · Status: todo
Production env vars, domain (e.g. `admin.gizetransport.com`), CSP verified, runbook section for the portal.
