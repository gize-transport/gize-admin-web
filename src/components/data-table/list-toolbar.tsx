import type { ReactNode } from "react";

/**
 * A list's toolbar row (GZW-076): search and filters on the left, the page's main action on the
 * right, all one height on one line; wraps on narrow screens. `below` holds what isn't a
 * control (a banner for a filter set elsewhere, a note).
 */
export function ListToolbar({
  children,
  action,
  below,
}: {
  children: ReactNode;
  action?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div data-toolbar-row className="flex flex-wrap items-center gap-2">
        {children}
        {/* The same height as the controls beside it. */}
        {action && (
          <div className="ml-auto *:h-9 *:px-3.5 *:text-table">{action}</div>
        )}
      </div>
      {below}
    </div>
  );
}
