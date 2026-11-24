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

## Deployment

The portal runs on Cloudflare Workers through OpenNext (architecture.md, "Deployment"):

- `npm run cf:build` builds the Worker into `.open-next/`; `npm run cf:preview` runs it locally on port 8787 in the Workers runtime (with the values in `.env.local`).
- Two sites, one build each (GZW-086):
  - **Staging, `https://staging-admin.gizetransport.com`:** CI deploys `main` there after every other check passes, and posts each PR's preview address (a staging version) on the PR.
  - **Production, `https://admin.gizetransport.com`:** once that `main` run succeeds, the **Release** workflow (`.github/workflows/release.yml`) waits for an approval. In GitHub **Actions → Release**, open the waiting run, check staging, and press **Review deployments → production → Approve and deploy**; it builds that commit with production's settings and deploys it. Only `main` can be released, and only the production environment's reviewers can approve. If several runs wait, approve the newest: a release deploys only `main`'s newest commit, so an older one approved later deploys nothing (its summary says so).
  - **Undo a release:** revert the commit on `main` (a PR as usual) and release that. Re-running an older release deploys nothing.
  - Never deploy by hand.
- GitHub settings: two **environments**, `staging` and `production`, each with the variables `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and `NEXT_PUBLIC_SENTRY_DSN` to turn on error reporting); a deploy stops if one of the first three is missing (the repository-level variables of the same names were removed after GZW-086, so nothing falls back to them). Production's variables point at the production API (`https://gize-api-production.onrender.com`) and the production Supabase project (`sxdsoaxzmqrqrjcgpcoq`) since 2026-11-24; staging's at the staging ones. Never put secrets in the `staging` environment: PR code can read them. Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token expires on 2027-11-10: make a new one with the same permissions before then.
- **What approval does and doesn't guard:** it stops the normal flow, every merge, from reaching production unapproved. It doesn't stop someone with write access: a PR's own CI file can reach the Cloudflare token, which can deploy either Worker. Give write access only to people trusted with production. (A separate Cloudflare token or account for staging would close this.)
- Each API must list its portal's address in its `CORS_ALLOWED_ORIGINS`, or signed-in screens can't load data: staging's API lists `staging-admin` (and `admin` until the backend removes it after the cutover, GZ-085), production's only `admin`.

## Supabase Auth settings

Invitations (sent by the API) and password resets are Supabase emails whose link lands on the portal (GZW-012): `/auth/confirm` shows a **Continue** button, and only pressing it uses the link (mail scanners that open every link don't use it up). In the Supabase dashboard, for each project:

1. **Authentication → URL Configuration:** Site URL = the address of the portal that uses this project: `https://staging-admin.gizetransport.com` for the staging project, `https://admin.gizetransport.com` for the production project. Redirect URLs: that address followed by `/**`, and `http://localhost:3000/**`.
2. **Authentication → Emails → Templates:** in **Invite user** and **Reset password**, the link goes to the portal's link page, not Supabase's default:
   - Invite user: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Set your password</a>`
   - Reset password: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Set a new password</a>`
3. **Authentication → Providers → Email:**
   - minimum password length **12** (the portal checks the same; owner decision);
   - turn on **Secure password change**, so a session older than a day must sign in again before changing the password (fresh sessions from an email link are fine);
   - **Email OTP expiration** at most 3600 seconds (the pages say links expire within an hour);
   - turn on leaked-password protection if your plan has it.
4. **Authentication → Emails → SMTP Settings:** Supabase's built-in sender allows only a few emails an hour and is meant for testing. For real invitations, set up your own SMTP (for example the Zoho mailbox of gizetransport.com).

## CI

Every PR runs these checks (`.github/workflows/ci.yml`): **Lint**, **Typecheck** (with the contract check), **Unit tests**, **Build**, **E2E (Playwright + axe)**, **npm audit**, **Secret scan (gitleaks)**, then **Deploy (Cloudflare)** once all of those pass (a PR preview, or staging on `main`). On `main` only, the separate **Release** workflow then waits for an approval (never a PR check). The e2e job uploads the Playwright report and the screenshots as artifacts.

## Working rules

One ticket (`GZW-xxx`) = one branch = one PR; see [`docs/workflow.md`](docs/workflow.md). Never commit to `main`; merge only when every CI check is green (`gh pr checks <n> --watch`).
