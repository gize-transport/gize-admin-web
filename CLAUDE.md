# Gize Admin Portal (frontend)

Next.js admin portal for Gize Transport staff. It is a **client of the Gize Admin API** (FastAPI, separate repo `gize-admin-api`), which owns all business rules and data. This app shows data, collects input and calls the API – it never decides permissions or business rules on its own.

## Read before any work

1. `docs/product-brief.md` – who uses the portal, screens, what each role can do
2. `docs/api-contract.md` – **how this repo stays in sync with the backend** (shared with the backend repo)
3. `docs/architecture.md` – stack, folders, auth, data fetching, API client
4. `docs/design-system.md` – brand tokens, components, screen patterns; mockups in `docs/designs/`
5. `docs/engineering-standards.md` – security, accessibility, testing, performance. **Non-negotiable.**
6. `docs/workflow.md` and `docs/milestones.md` – one ticket (`GZW-xxx`) = one branch = one PR

If documents conflict: `api-contract.md` and `engineering-standards.md` win, then `architecture.md`, then the rest.

## Stack (decided – do not change without asking)

- Next.js (App Router) + TypeScript (`strict`), Tailwind CSS, shadcn/ui (Radix primitives) for accessible components
- Auth: Supabase Auth via `@supabase/ssr` (cookie session) + middleware route protection
- API: `openapi-typescript` (generated types) + `openapi-fetch`; TanStack Query for server state; TanStack Table for tables
- Forms: react-hook-form + zod (limits must match the OpenAPI schema)
- Tests: Vitest + Testing Library + MSW (typed from the generated schema); Playwright for end-to-end
- Errors: Sentry (PII scrubbing on). Lint/format: ESLint + Prettier
- Hosting: Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`)

Ask before adding any other dependency.

## Non-negotiables (summary)

- **Never hand-write API types or endpoint URLs.** Use the generated client. If an endpoint you need is missing, stop and ask for a backend ticket.
- **The UI hides what a role can't do, but the API enforces it.** Never rely on hidden buttons for security; always handle 403.
- Access tokens never go into localStorage, URLs or logs. No `dangerouslySetInnerHTML`.
- Every API call handles loading, empty, error (problem+json `code` → friendly message + request ID) and 429 (respect `Retry-After`).
- Side-effecting actions send an `Idempotency-Key` and disable the button while pending.
- Accessible: keyboard-only usable, labelled inputs, focus management in dialogs, WCAG AA contrast.
- Done = typecheck, lint, unit tests and the ticket's Playwright flow all pass; generated API files unchanged in CI.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- `npm test` (Vitest) · `npm run e2e` (Playwright)
- `npm run contract:sync -- --tag api-vX.Y.Z` – pull the backend contract and regenerate types

## Working style

Follow `docs/workflow.md`: plan → wait for approval → tests → code → self-review → PR titled `GZW-xxx: <title>`. Never commit to `main`. Never weaken a test, lint rule or CI step to pass.
