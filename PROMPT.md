# Prompts for Claude Code – admin portal

## Before you start (you, not Claude)

1. Create an empty private repo `gize-admin-web` in the company GitHub Organization; clone it.
2. Unzip this kit into the repo root (`CLAUDE.md`, `PROMPT.md`, `docs/`, `.github/` at the top level) and commit to `main`.
3. Enable the hook that blocks direct pushes to `main`: `git config core.hooksPath .githooks` (once per clone). In **Settings → General → Pull Requests**, tick **Allow squash merging** and **Automatically delete head branches**.
4. Install Node LTS, the GitHub CLI (`gh auth login` with access to **both** repos), and Docker (to run the backend locally for e2e tests).
5. Start Claude Code in the repo root: `claude`.

## Order of work across the two repos

- W0 (foundation) can start now, in parallel with backend M0.
- Each later frontend milestone starts once its backend tickets are merged **and** tagged `api-v*` (see "Needs backend" in `docs/milestones.md`).
- Suggested rhythm: backend milestone N merged → frontend milestone N while backend works on N+1.

## Build the MVP (milestone mode) – paste everything below the line

---

You are the frontend engineer for the Gize Admin Portal. Read `CLAUDE.md`, then `docs/product-brief.md`, `docs/api-contract.md`, `docs/architecture.md`, `docs/design-system.md` (and look at every image in `docs/designs/screens/`), `docs/engineering-standards.md`, `docs/workflow.md`, `docs/milestones.md` and `.github/pull_request_template.md`.

First reply, no code: (1) your summary of the product, the contract rules and the design direction, so I can check we're aligned; (2) anything unclear or risky with your recommendation; (3) the milestone plan for **W0 – Foundation**.

Then build the MVP – milestones **W0 to W6** – in milestone mode:

1. **Milestone plan – then stop.** Post one plan covering all tickets in the milestone (plan template in `docs/workflow.md` per ticket) and wait for my approval.
2. **Before each ticket**, run `npm run contract:sync` (once GZW-003 exists) and confirm every endpoint, field and error code the ticket needs is in `schema.d.ts`. If anything is missing, or the ticket's "Needs backend" tickets aren't tagged yet, **stop and tell me exactly what the backend must add**. Never invent endpoints or types.
3. **For each ticket:** branch from `main`, tests first (component states with MSW + the Playwright flow), implement against the design system and mockups, run typecheck/lint/unit/e2e/axe, complete the self-review checklist, attach screenshots at 1440 px and 375 px.
4. **Independent review:** start a subagent with no context of your implementation to review the diff against `docs/engineering-standards.md`, `docs/api-contract.md` and the mockups. Fix findings or explain why they don't apply.
5. **Open the PR** with `gh pr create` (title `GZW-xxx: <title>`, template filled, CONTRACT_VERSION stated), update the ticket status in `docs/milestones.md` in the same PR, wait for CI with `gh pr checks <number> --watch`, and merge only when every check is green (`gh pr merge <number> --squash --delete-branch`). Never merge with failing or pending checks.
6. **End of milestone – stop** and report: PRs merged, screens built (with screenshots), contract version used, backend gaps found, risks, next milestone plan.

Stop and ask if a standard would have to be broken, the contract is missing something, the API behaves differently from its docs, a design decision affects several screens and isn't covered, or a new dependency/env var/service is needed. Never weaken a test, lint rule, type check or CI step. Never hand-edit generated API files.

---

## When the backend publishes a new contract

> The backend tagged api-vX.Y.Z. Run contract:sync to that tag, show me the changelog, fix any type errors it causes, and open a PR `GZW-chore: sync contract api-vX.Y.Z`.

## Strict review in a fresh session

> Review PR #<n> for GZW-xxx as a strict senior frontend reviewer against docs/engineering-standards.md, docs/api-contract.md and docs/design-system.md. List every violation with file and line, missing states, missing tests and accessibility issues. Don't fix anything yet.
