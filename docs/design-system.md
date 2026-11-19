# Design system – admin portal

## Source designs

- `docs/designs/screens/*.png` – screenshots of the admin mockups; `docs/designs/html/*.dc.html` – their HTML (inline styles; open in a browser to inspect spacing).
- **Use the mockups for layout, information hierarchy and interactions. Use the colours and fonts below, not the mockups' amber/teal palette** – the brand has since been fixed from our TikTok and website.
- Mapping from mockup to brand: dark sidebar `#16181B` → Gize Navy; teal → Gize Blue / Royal Blue; amber accents and "needs action" → Sun Yellow; warm off-white background → `canvas` (neutral near-white; `ice` only for selected/hover/active filter).
- Screens not in the mockups (sign-in, areas, corridors, companies, route requests, staff, audit log) follow the same list + detail patterns. The waitlists mockup (`AdminWaitlists.png`) is only a layout reference for the Demand screen – there are no waitlists.

## Tokens (define once as CSS variables + Tailwind theme)

Defined in `src/app/globals.css` (Tailwind's default palette is removed, so only these exist as utilities: `bg-navy`, `text-muted`, …). `src/app/tokens.test.ts` checks the contrast of every text/background pair below.

| Token | Value | Use |
| --- | --- | --- |
| `navy` | `#012768` | Sidebar, primary buttons, headings on light |
| `royal` | `#054CC3` | Links, focus ring, selected states |
| `blue` | `#0D77EB` | Active nav item indicator, info (not for small text on white: 4.3:1) |
| `sky` | `#159ED5` | Gize brand blue (from the website). Small accents on navy only |
| `ice` | `#E9F3FD` | Selected rows, row hover, active filter chip – nothing else |
| `sun` | `#FFC928` | "Needs action": forming routes, new route requests – navy text on it |
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

- Shell: left sidebar (navy, 240–260 px; collapses to a drawer under 1024 px), page header with title, one-line summary and primary action on the right. Decided in GZW-011:
  - Sidebar: logo with "Gize ADMIN", the navigation (`src/components/shell/nav-items.ts`), and at its foot the signed-in name, role and Sign out (as in `Admin.png`; no top header). Below 1024 px a navy top bar holds the menu button and logo; the menu is the same sidebar as a drawer (focus trapped, Escape closes, focus returns to the button).
  - Only screens that exist appear in the navigation (`available` per item; each screen ticket turns its item on). Admin-only items are hidden from Staff; pages still handle a 403 with `NoPermission`.
  - Current page: white text on `white/10` with a `blue` bar, and `aria-current="page"`. On navy the focus ring is white (royal on navy is under 3:1).
  - Since GZW-073: an icon (lucide, 18 px, `aria-hidden`) before every label; groups under small-capital headings (Operations, People, Places, Admin – admins only), each a list named by its heading, Overview alone at the top. Waiting work shows as a sun count (navy text) at the item's right end, outside the link (the current-page mark waits for the URL, the count for data); the link is described by it ("Route requests", "6 open"), "99+" above 99, and none at 0 – only Route requests has one, so it isn't diluted. The account is a card: `Avatar` (initials, `aria-hidden`, sky on navy), name, role pill, Sign out with an icon.
  - A "Skip to content" link is the first stop for keyboard users. Each page renders inside the shell's `<main>`, so pages start with `PageHeader` and don't add their own `<main>`.
- **DataTable**: sticky header, row hover, row click opens detail (side panel on ≥1280 px, full page otherwise), cursor pagination, filter chips synced to URL, empty state with next action, skeleton loading. Decided in GZW-005:
  - The table scrolls inside its own box: from 768 px the box is at most ~70% of the screen height, with sticky header and first column. On phones the box has no height limit (the page scrolls) and the first column stays pinned while the table scrolls sideways. The box is a labelled, focusable region.
  - Each row's first column holds a `RowAction` (a real button or link). Clicking anywhere else on the row activates it; clicks on other controls or while selecting text don't.
  - Pagination: "Next page" (adds the API's cursor to the URL, so the browser's Back goes to the previous page) and "First page" once past page 1. No in-app "Previous" – the API only returns a next cursor.
  - Filter chips: one choice plus "All"; a check mark shows the active chip (not colour alone). Changing a filter goes back to the first page.
  - Since GZW-074: the list's search and filters sit in the card's top bar (`toolbar`), shown in every state (loading, no matches, errors) and never remounted, so typing isn't interrupted – a screen must not swap the table for something else (Riders shows a partly typed phone through `emptyState`). Header row: `canvas` band, uppercase by CSS only (the text itself keeps its case). Rows: roomier, lighter dividers, equal-width digits. The first cell can have a picture (`CellWithPicture`): `Avatar` initials for people (riders, drivers, staff, route-request riders), `IconAvatar` for records (companies, areas, corridors – the sidebar's icons; not routes, the widest list, where Status must stay in view); for sight only and left out on phones, where the pinned column needs the room. No row count: lists have no total.
- **Detail panel / page**: key facts grid, related lists, actions at the bottom; destructive actions separated and confirmed. Decided in GZW-029 (Companies, the first detail):
  - Each record has its own page (`/companies/[id]`): the shareable link, and the view below 1280 px. It starts with a "← All companies" link and the name as `h1`, inside an `<article>` named by it.
  - From 1280 px a row's link (still a real link, so a new tab opens the page) opens the same detail in a side panel beside the list instead: `?company=<id>` on the list's URL (Back closes it), the row marked current, the panel an `<aside>` named by the record (`h2`) with a close button. Focus moves into the panel when it opens and back to the row when it closes. A panel link opened on a narrower screen goes to the page.
  - Facts are a `<dl>` in a labelled group; related lists are small tables; personal data (contact phone and email) only appears on the detail, never in the list.
  - Shared since GZW-021: `DetailFrame` (`src/components/detail/detail-frame.tsx`: loading, no permission, not found incl. a 422 on the path, errors, the page/panel wrapper and focus) with `DetailHeading`, `Facts`/`Fact` and `BackLink`; `useDetailPanel` (`use-detail-panel.ts`: the list side – row links, `?<param>=`, focus back to the row, the narrow-screen redirect). Routes use `/routes/[id]` and `?route=`.
- **StatusPill**: one component, colour by status family (active/success, waiting/sun, paused/neutral, rejected/danger), with a dot before the label (since GZW-074, `aria-hidden`). The label always names the status. Mapping:

  | Status | Tone | Label |
  | --- | --- | --- |
  | Route `draft` | neutral | Draft |
  | Route `forming` | waiting (sun) | Forming · 9 of 12 (launch progress from the API) |
  | Route `active` | success | Active |
  | Route `paused` | neutral | Paused |
  | Request `new` | waiting (sun) | New |
  | Request `matched` | neutral | Matched · R-14 |
  | Request `fulfilled` | success | Fulfilled |
  | Request `declined` | danger | Declined |
  | Company active / inactive | success / neutral | Active / Inactive |
  | Staff pending (never signed in) / inactive | waiting / neutral | Pending / Deactivated |

- **LaunchProgress** (`src/components/launch-progress.tsx`): "9 of 12 needed" as text plus a native `<meter>` (role meter, no inline style for the strict CSP); numbers come from the API (`reserved`, `launch_minimum`). Used in the routes list, route detail and the launch dialog (per month from the launch months list).
- **Status actions** (route detail): one button per move in the route's `status_changes`. A move that isn't `ready` stays visible but disabled (`aria-disabled`, still focusable) with its reasons as text under it, linked by `aria-describedby` – never a tooltip only. Launch opens a dialog with the launch months as a radio list (month, riders reserved, ready or not); months that aren't ready can't be chosen. Launch can be opened when riders are its only blocker (that judges the earliest month only; a later one may be ready – owner decision, GZW-024).
- **Route times**: four times in order, shown as "Leaves A 06:30 → arrives B 07:15" and "Leaves B 17:30 → arrives A 18:15"; a missing arrival time shows "Not set". **Areas served**: shown as a path "A → CMC → Megenagna → B"; edited as an ordered list with move up / move down buttons (keyboard-accessible, no drag-only).
- **Pickers**: areas, corridors, companies and routes are chosen with a searchable, keyboard-accessible combobox over the API list (never free text): areas by name (`q`), companies by name start (`q`, active only for routes), routes by code start (`q`). A corridor is picked as origin area + destination area (corridors have a direction; always show "origin → destination"): `CorridorField` (`src/components/pickers/corridor-field.tsx`) looks the corridor up when both are chosen, confirms it, or says there's none yet with a link to Corridors. `AreaPicker` (`src/components/pickers/area-picker.tsx`, GZW-026) is the pattern the other pickers follow (since GZW-029 they are thin wrappers around `SearchPicker`, which takes the search, a cache key under the entity's own key and the words; `CompanyPicker` offers active companies only, or all with `includeInactive` for a list filter; `RoutePicker` finds routes by code): a button showing the choice opens a search box over the list; results update after a short pause in typing and show "Searching…" until they match the text (so Enter never picks a stale option); the first 20 matches are shown, with a hint to type more when the API has more; errors show inside it with the reference and Retry. Times use `<input type="time">` (`HH:MM`); launch and start dates offer the 1st of each month.
- **Corporate routes** show "Rate agreed with the company" where individual routes show prices.
- **Forms**: labels above fields, helper text for constraints (matching API limits), inline errors, primary + secondary buttons; disable submit while pending.
- **Buttons**: primary (navy), secondary (white with border), ghost, destructive (danger), link. While an action runs the button shows a spinner and is `aria-disabled` (keeps focus).
- **ConfirmDialog** opens on Cancel and returns focus to the opener; it stays open (and can't be dismissed) while the action runs, so failures show inside it. Used for launching a route, starting forming or going back to draft, pausing or resuming one, adding a van, declining a route request, approving/rejecting drivers, deleting, changing roles – states the consequence in plain words.
- **ProblemAlert**: friendly message per error code + "Reference: <request_id>" with copy button; on 429 it counts down `Retry-After` and enables "Try again" when it ends.
- **Toasts** only for success confirmations; errors stay visible inline.

## Motion and polish

Subtle only: 150–200 ms transitions on hover/focus, panel slide-in, skeleton shimmer; respect `prefers-reduced-motion`. This is a work tool – clarity and speed beat decoration.
