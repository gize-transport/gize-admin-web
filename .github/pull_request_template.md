## Ticket
GZW-___ – <title> · Depends on backend: GZ-___ · CONTRACT_VERSION: api-v_._._

## What changed
-

## Screens
| Screen | 1440 px | 375 px |
| --- | --- | --- |

## API calls
| operationId | Error codes handled |
| --- | --- |

## How it was tested
-

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

## Risks and follow-ups
-
