# Gize Admin Portal (frontend)

Next.js admin portal for Gize Transport staff. It is a client of the Gize Admin API (`gize-admin-api`). Start with [`CLAUDE.md`](CLAUDE.md) and the documents in [`docs/`](docs/).

## Setup

1. Node 24 (see `.nvmrc`) and npm.
2. `brew install gitleaks` – the pre-commit hook blocks commits without it.
3. `npm ci` – also enables the git hooks in `.githooks/` (blocks pushes to `main`; scans and lints staged files).
4. `cp .env.example .env.local` and fill in the values (public values only). `npm run dev`, `build` and `start` stop with a list of what's missing until they are valid; `npm run typecheck` and `npm test` don't need them.
5. `npx playwright install chromium` once, for end-to-end tests.

## Commands

| Command                                     | What it does                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                               | Start the dev server on http://localhost:3000                                     |
| `npm run build`                             | Production build                                                                  |
| `npm run lint`                              | ESLint (no warnings allowed)                                                      |
| `npm run typecheck`                         | Generate route types, then `tsc --noEmit`                                         |
| `npm run format`                            | Format with Prettier (`format:check` only checks)                                 |
| `npm test`                                  | Unit and component tests (Vitest)                                                 |
| `npm run e2e`                               | Playwright + axe at 1440 px and 375 px (builds first, port 3100)                  |
| `npm run screenshots`                       | Screenshots of every screen in `e2e/support/screens.ts` into `screenshots/`       |
| `npm run contract:sync -- --tag api-vX.Y.Z` | Pull the backend contract at a tag (default: latest) and regenerate the API types |
| `npm run contract:check`                    | Check the generated API files against `openapi.json` (offline; runs in CI)        |

## API contract

The backend (`gize-admin-api`) owns the API contract; see [`docs/api-contract.md`](docs/api-contract.md). `npm run contract:sync` uses the GitHub CLI (`gh auth login` with access to the backend repo) to download `openapi.json` and `docs/api-contract.md` at an `api-v*` tag. It writes `src/lib/api/openapi.json`, `CONTRACT_VERSION` and `contract.sha256` (checksums of the two downloaded files) and regenerates `src/lib/api/schema.d.ts`. These files are generated: never edit them by hand. The Typecheck job runs `npm run contract:check`, which fails if `schema.d.ts` differs from what `openapi.json` generates or if a downloaded file no longer matches its checksum.

A daily workflow (`.github/workflows/contract-update.yml`) opens an issue "Contract update available: api-vX.Y.Z" with oasdiff's summary and changelog when the backend has a newer tag, and fails if the pinned files differ from the backend's at the pinned tag. It needs the repository secret `BACKEND_CONTRACT_TOKEN`: a fine-grained token with read-only **Contents** access to `gize-admin-api` only. Without it, the job skips with a warning.

## Calling the API

- `api` (`src/lib/api/client.ts`) is the typed client: paths, parameters and bodies come from `schema.d.ts`. It adds the Supabase access token to every request.
- Wrap each call in `unwrap(...)`. It returns the data or throws an `ApiError` (`src/lib/api/problem.ts`) with `code`, `requestId`, `retryAfterSeconds` and `fieldErrors`.
- In components, `useApiErrorMessages()` (`errors.ts`) turns an error into a friendly sentence and gives a reason per form field. Show the message with `ProblemAlert`, together with the request ID.
- Creates take `useIdempotencyKey()` (`idempotency.ts`): reuse the key on retry, renew it after success.
- TanStack Query (`query-client.ts`, mounted by `QueryProvider`): reads retry only lost connections and 502/504 errors, at most twice; mutations never retry on their own; a 401 anywhere goes to `/sign-in?next=…`.
- Times: `useTimestampFormat()` shows UTC timestamps in Addis Ababa time. Schedule times (`"HH:MM"`) are shown as sent, and `scheduleTimeSchema` validates them in forms.
- Unit tests mock the API with MSW (`tests/msw/`): `apiUrl("/v1/areas")` only accepts paths from the contract, and requests without a handler fail.
- Error reporting: Sentry runs in the browser only when `NEXT_PUBLIC_SENTRY_DSN` is set. It collects no user, cookie, header, body or query data (`src/lib/sentry.ts`).

## Sign-in and e2e stand-ins

- Every page except `/sign-in` (and the dev gallery) needs a session: `src/middleware.ts` checks it with Supabase and sends signed-out visitors to `/sign-in?next=…`. After the password, the portal asks the API who this is (`staff_me`). Someone who isn't active staff is signed out again with the reason.
- `npm run e2e` starts local stand-ins for Supabase Auth and the API (`e2e/support/fake-services.mjs`), and the e2e build points `NEXT_PUBLIC_*` at them. Test accounts per role are in `e2e/support/test-users.mjs`; they exist only in the stand-ins. `signIn(page, "staff")` (`e2e/support/auth.ts`) signs a test in, and screens set `signInAs` in `e2e/support/screens.ts`.

## Shared components

`/dev/components` shows every shared component (tokens, type, buttons, DataTable, dialogs…). It exists under `npm run dev` and in production builds made with the server-only build flag `GIZE_DEV_PAGES=1`, which only the e2e builds set (Playwright locally, the Build job in CI). Deployed builds don't set it, so the page is a 404 there.

## CI

Every PR runs these checks (`.github/workflows/ci.yml`): **Lint**, **Typecheck** (with the contract check), **Unit tests**, **Build**, **E2E (Playwright + axe)**, **npm audit**, **Secret scan (gitleaks)**. The e2e job uploads the Playwright report and the screenshots as artifacts.

## Working rules

One ticket (`GZW-xxx`) = one branch = one PR; see [`docs/workflow.md`](docs/workflow.md). Never commit to `main`; merge only when every CI check is green (`gh pr checks <n> --watch`).
