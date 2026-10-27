# Design system – admin portal

## Source designs

- `docs/designs/screens/*.png` – screenshots of the admin mockups; `docs/designs/html/*.dc.html` – their HTML (inline styles; open in a browser to inspect spacing).
- **Use the mockups for layout, information hierarchy and interactions. Use the colours and fonts below, not the mockups' amber/teal palette** – the brand has since been fixed from our TikTok and website.
- Mapping from mockup to brand: dark sidebar `#16181B` → Gize Navy; teal → Gize Blue / Royal Blue; amber accents and "needs action" → Sun Yellow; warm off-white background → Ice/neutral.
- Screens not in the mockups (sign-in, corridors, staff, audit log) follow the same patterns.

## Tokens (define once as CSS variables + Tailwind theme)

| Token | Value | Use |
| --- | --- | --- |
| `navy` | `#012768` | Sidebar, primary buttons, headings on light |
| `royal` | `#054CC3` | Links, focus ring, selected states |
| `blue` | `#0D77EB` | Active nav item indicator, info |
| `sky` | `#11A7F8` | Small accents on navy only |
| `ice` | `#E9F3FD` | Page background tint, selected rows |
| `sun` | `#FFC928` (approx.) | "Needs action" badges, waitlist-ready – navy text on it |
| `surface` | `#FFFFFF` | Cards, tables |
| `ink` | `#16181B` | Body text |
| `muted` | `#55595F` | Secondary text |
| `line` | `#D9DEE6` | Borders |
| `success` | `#0E7A4F` | Active, paid, passed |
| `danger` | `#B42318` | Errors, destructive actions, stopped |

Contrast ≥ 4.5:1 for text. Never white text on `sky` or `sun`.

## Type

- UI: **Sora** for page titles and big numbers; **Noto Sans** for UI text; **Noto Sans Ethiopic** in every font stack so Amharic data renders. Monospace (**JetBrains Mono**) for codes, plates and references.
- Sizes: page title 28–32, section 17–18, body 15, table 14, meta 13. Line-height 1.5 (1.6 for Amharic-heavy text).

## Layout and components

- Shell: left sidebar (navy, 240–260 px; collapses to a drawer under 1024 px), page header with title, one-line summary and primary action on the right.
- **DataTable**: sticky header, row hover, row click opens detail (side panel on ≥1280 px, full page otherwise), cursor pagination, filter chips synced to URL, empty state with next action, skeleton loading.
- **Detail panel / page**: key facts grid, related lists, actions at the bottom; destructive actions separated and confirmed.
- **StatusPill**: one component, colour by status family (active/success, waiting/sun, paused/neutral, rejected/danger).
- **Forms**: labels above fields, helper text for constraints (matching API limits), inline errors, primary + secondary buttons; disable submit while pending.
- **ConfirmDialog** for opening a route from a waitlist, approving/rejecting drivers, deleting, changing roles – states the consequence in plain words.
- **ProblemAlert**: friendly message per error code + "Reference: <request_id>" with copy button.
- **Toasts** only for success confirmations; errors stay visible inline.

## Motion and polish

Subtle only: 150–200 ms transitions on hover/focus, panel slide-in, skeleton shimmer; respect `prefers-reduced-motion`. This is a work tool – clarity and speed beat decoration.
