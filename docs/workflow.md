# Workflow: one ticket, one branch, one PR

Tickets live in `docs/milestones.md` (IDs `GZW-xxx`). Each lists the backend tickets (`GZ-xxx`) it depends on.

## The loop

1. **Check the contract first.** Run `npm run contract:sync` to the latest backend `api-v*` tag. If an endpoint, field or error code the ticket needs is not in `schema.d.ts`, **stop** and report which backend ticket is missing. Never invent endpoints.
2. **Plan – then stop.** Post the plan (template below) and wait for approval.
3. **Branch** `feat/GZW-012-short-name` from up-to-date `main`.
4. **Tests first:** component tests with MSW for each state, and the Playwright flow; show them failing.
5. **Implement** following `architecture.md` and `design-system.md`; compare against the mockup.
6. **Run everything:** typecheck, lint, unit tests, e2e, axe.
7. **Self-review** with the checklist; attach before/after screenshots of each changed screen at 1440 px and 375 px.
8. **PR** titled `GZW-012: <title>` with the template; state the `CONTRACT_VERSION` used. Update the ticket status in `milestones.md` in the same PR.

## Plan template

```
## GZW-012 – <title>
Depends on backend: GZ-0xx (contract api-vX.Y.Z)
Goal / Out of scope:
Screens & components: new/changed, with the mockup they follow
API calls: operationId – method/path – used for – error codes handled
Role behaviour: what Staff vs Admin see and can do
States: loading / empty / error / 403 / 429 / pending handling
Forms: fields, zod rules (matching API limits)
Test list: unit cases + e2e flow
Open questions:
```

## Self-review checklist

- [ ] Only the generated API client used; contract files untouched by hand; CONTRACT_VERSION stated
- [ ] Every error code the endpoint can return has a message; request ID shown on errors
- [ ] Role-hidden actions still handle 403; no security decisions in the UI
- [ ] All states covered: loading, empty, error, 403, 404, 429, pending
- [ ] Idempotency-Key on side-effecting actions; buttons disabled while pending
- [ ] Keyboard and screen-reader usable; axe clean; focus handled in dialogs
- [ ] Matches the design system tokens (not the mockups' old colours); screenshots attached
- [ ] No tokens or personal data in logs, URLs or Sentry
- [ ] Strings in messages/en.json; TypeScript strict and lint clean
- [ ] Unit + e2e tests for the ticket pass; nothing skipped or weakened

## Stop and ask when

- The contract lacks something the ticket needs, or the API behaves differently from the docs.
- A design decision isn't covered by the mockups or design system and affects more than one screen.
- A new dependency, environment variable or service is needed.
