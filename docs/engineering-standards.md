# Engineering standards – admin portal

A PR that breaks any of these is not done.

## API usage and contract

- All API calls go through `lib/api/client.ts` (openapi-fetch typed by `schema.d.ts`). No `fetch` to the API anywhere else, no hand-written request/response types, no hard-coded paths outside the generated types.
- `lib/api/openapi.json` and `schema.d.ts` are generated only by `npm run contract:sync`; CI fails if they differ from a fresh generation.
- `lib/api/errors.ts` maps **every** error code in the schema to a message (TypeScript exhaustiveness check), with a generic fallback for unknown codes.
- Form validation (zod) mirrors API limits from the schema (max lengths, ranges, enums); the API remains the final validator and its field errors are shown on the matching fields.

## Security

- Session only in Supabase's cookies (`@supabase/ssr`). They can't be HttpOnly, because the browser sends the access token to the API (owner decision, 2026-11-01), so no script we don't write may run on the page: strict CSP, no `dangerouslySetInnerHTML`, no third-party scripts. Access tokens never in localStorage/sessionStorage, URLs, logs or Sentry.
- Role checks in the UI are convenience only; every mutation handles 403 and 404 gracefully.
- No `dangerouslySetInnerHTML`, no `eval`, no rendering of untrusted HTML. Links built from data use safe URL helpers.
- Security headers: CSP (self + API + Supabase + Sentry origins only), `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
- Only `NEXT_PUBLIC_*` variables, validated at build; no secrets in the repo (gitleaks in pre-commit and CI). `npm audit --audit-level=high` in CI.
- Sentry scrubs names, phone numbers and request bodies; logs nothing personal to the console in production.
- File uploads (driver documents): check type and size client-side before requesting a signed URL; upload directly to the signed URL; never proxy files through the app.

## UX states (every data screen)

- Loading (skeletons), empty (with next action), error (ProblemAlert with request ID and retry), forbidden (403 page), not found (404), rate limited (429 with countdown), offline/slow network message.
- Mutations: button disabled + spinner while pending; `Idempotency-Key` generated per user action and reused on manual retry; success toast; affected queries invalidated.
- Destructive or bulk actions use ConfirmDialog with plain-language consequences.

## Accessibility

- WCAG 2.2 AA: keyboard-only operable, visible focus ring (`royal`), labels on all inputs, errors linked with `aria-describedby`, dialogs trap and restore focus, tables use proper headers, status not by colour alone.
- Automated check with `@axe-core/playwright` on every page in e2e; zero serious/critical violations.

## Performance

- Route-level code splitting; no heavy libraries on the sign-in page. Tables paginate server-side (never fetch "all").
- Lighthouse (desktop) ≥ 90 performance and ≥ 95 accessibility on the main screens.

## Testing (required for "done")

- **Unit/component (Vitest + Testing Library + MSW):** for each screen – renders data, empty state, API error with request ID, 403, validation errors from the API mapped to fields, pending state on mutations.
- MSW handlers are typed from `schema.d.ts`, so a contract change breaks the mocks at compile time.
- **E2E (Playwright):** each ticket's main flow (e.g. assign rider → ROUTE_FULL handled) against the local backend in CI (backend Docker image + seed data) or staging; plus axe checks.
- No snapshot-only tests; test behaviour the user sees.

## Code quality

- TypeScript `strict`, no `any` without a comment; ESLint + Prettier clean.
- Components small and named by purpose; domain logic in `features/<domain>`; shared UI in `components/`.
- Strings in `messages/en.json`; no hard-coded user-facing text in components.
- Times follow `architecture.md` → Times: timestamps displayed in Africa/Addis_Ababa; schedule times (`"HH:MM"`) shown and sent unchanged, never converted.
- Conventional commits with ticket ID: `feat(riders): assign to route dialog [GZW-031]`.
