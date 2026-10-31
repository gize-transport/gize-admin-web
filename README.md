# Gize Admin Portal (frontend)

Next.js admin portal for Gize Transport staff. It is a client of the Gize Admin API (`gize-admin-api`). Start with [`CLAUDE.md`](CLAUDE.md) and the documents in [`docs/`](docs/).

## Setup

1. Node 24 (see `.nvmrc`) and npm.
2. `brew install gitleaks` – the pre-commit hook blocks commits without it.
3. `npm ci` – also enables the git hooks in `.githooks/` (blocks pushes to `main`; scans and lints staged files).
4. `cp .env.example .env.local` and fill in the values (public values only).
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

## Shared components

`/dev/components` shows every shared component (tokens, type, buttons, DataTable, dialogs…). It exists under `npm run dev` and in production builds made with the server-only build flag `GIZE_DEV_PAGES=1`, which only the e2e builds set (Playwright locally, the Build job in CI). Deployed builds don't set it, so the page is a 404 there.

## CI

Every PR runs these checks (`.github/workflows/ci.yml`): **Lint**, **Typecheck** (with the contract check), **Unit tests**, **Build**, **E2E (Playwright + axe)**, **npm audit**, **Secret scan (gitleaks)**. The e2e job uploads the Playwright report and the screenshots as artifacts.

## Working rules

One ticket (`GZW-xxx`) = one branch = one PR; see [`docs/workflow.md`](docs/workflow.md). Never commit to `main`; merge only when every CI check is green (`gh pr checks <n> --watch`).
