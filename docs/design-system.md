# Design system – admin portal

## Source designs

- `docs/designs/screens/*.png` – screenshots of the admin mockups; `docs/designs/html/*.dc.html` – their HTML (inline styles; open in a browser to inspect spacing).
- **Use the mockups for layout, information hierarchy and interactions. Use the colours and fonts below, not the mockups' amber/teal palette** – the brand has since been fixed from our TikTok and website.
- Mapping from mockup to brand: dark sidebar `#16181B` → Gize Navy; teal → Gize Blue / Royal Blue; amber accents and "needs action" → Sun Yellow; warm off-white background → `canvas` (neutral near-white; `ice` only for selected/hover/active filter).
- Screens not in the mockups (sign-in, corridors, staff, audit log) follow the same patterns.

## Tokens (define once as CSS variables + Tailwind theme)

Defined in `src/app/globals.css` (Tailwind's default palette is removed, so only these exist as utilities: `bg-navy`, `text-muted`, …). `src/app/tokens.test.ts` checks the contrast of every text/background pair below.

| Token | Value | Use |
| --- | --- | --- |
| `navy` | `#012768` | Sidebar, primary buttons, headings on light |
| `royal` | `#054CC3` | Links, focus ring, selected states |
| `blue` | `#0D77EB` | Active nav item indicator, info (not for small text on white: 4.3:1) |
| `sky` | `#159ED5` | Gize brand blue (from the website). Small accents on navy only |
| `ice` | `#E9F3FD` | Selected rows, row hover, active filter chip – nothing else |
| `sun` | `#FFC928` | "Needs action" badges, waitlist-ready – navy text on it |
| `canvas` | `#F6F8FB` | Page background (neutral near-white) |
| `surface` | `#FFFFFF` | Cards, tables, dialogs |
| `ink` | `#16181B` | Body text |
| `muted` | `#55595F` | Secondary text |
| `line` | `#D9DEE6` | Borders |
| `success` | `#0E7A4F` | Active, paid, passed |
| `success-soft` | `#E3F4EC` | Background of success pills |
| `danger` | `#B42318` | Errors, destructive actions, stopped |
| `danger-soft` | `#FDECEA` | Background of danger pills and error alerts |
| `neutral-soft` | `#ECEFF3` | Background of neutral pills, skeletons |

Contrast ≥ 4.5:1 for text. Never white text on `sky` or `sun`. Focus ring: 2 px `royal` outline with 2 px offset, on every focusable element (globals.css).

## Type

- UI: **Sora** for page titles and big numbers; **Noto Sans** for UI text; **Noto Sans Ethiopic** in every font stack so Amharic data renders. Monospace (**JetBrains Mono**) for codes, plates and references.
- Sizes: page title 28–32, section 17–18, body 15, table 14, meta 13. Line-height 1.5 (1.6 for Amharic-heavy text). Tailwind classes: `text-title`, `text-section`, `text-body`, `text-table`, `text-meta`; fonts: `font-display` (Sora), `font-sans` (Noto Sans, default), `font-mono`.
- Fonts are self-hosted by `next/font` (`src/app/fonts.ts`); Noto Sans Ethiopic is in every stack.

## Layout and components

- Shell: left sidebar (navy, 240–260 px; collapses to a drawer under 1024 px), page header with title, one-line summary and primary action on the right.
- **DataTable**: sticky header, row hover, row click opens detail (side panel on ≥1280 px, full page otherwise), cursor pagination, filter chips synced to URL, empty state with next action, skeleton loading. Decided in GZW-005:
  - The table scrolls inside its own box: from 768 px the box is at most ~70% of the screen height, with sticky header and first column. On phones the box has no height limit (the page scrolls) and the first column stays pinned while the table scrolls sideways. The box is a labelled, focusable region.
  - Each row's first column holds a `RowAction` (a real button or link). Clicking anywhere else on the row activates it; clicks on other controls or while selecting text don't.
  - Pagination: "Next page" (adds the API's cursor to the URL, so the browser's Back goes to the previous page) and "First page" once past page 1. No in-app "Previous" – the API only returns a next cursor.
  - Filter chips: one choice plus "All"; a check mark shows the active chip (not colour alone). Changing a filter goes back to the first page.
- **Detail panel / page**: key facts grid, related lists, actions at the bottom; destructive actions separated and confirmed.
- **StatusPill**: one component, colour by status family (active/success, waiting/sun, paused/neutral, rejected/danger).
- **Forms**: labels above fields, helper text for constraints (matching API limits), inline errors, primary + secondary buttons; disable submit while pending.
- **Buttons**: primary (navy), secondary (white with border), ghost, destructive (danger), link. While an action runs the button shows a spinner and is `aria-disabled` (keeps focus).
- **ConfirmDialog** opens on Cancel and returns focus to the opener; it stays open (and can't be dismissed) while the action runs, so failures show inside it. Used for opening a route from a waitlist, approving/rejecting drivers, deleting, changing roles – states the consequence in plain words.
- **ProblemAlert**: friendly message per error code + "Reference: <request_id>" with copy button; on 429 it counts down `Retry-After` and enables "Try again" when it ends.
- **Toasts** only for success confirmations; errors stay visible inline.

## Motion and polish

Subtle only: 150–200 ms transitions on hover/focus, panel slide-in, skeleton shimmer; respect `prefers-reduced-motion`. This is a work tool – clarity and speed beat decoration.
