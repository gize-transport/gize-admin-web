"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyFailedNotice, NoticeContext } from "./actions-menu";
import { DetailHeading, type DetailLayout } from "./detail-frame";

type DetailHeaderProps = {
  layout: DetailLayout;
  /** The record's name (or a route's code). */
  title: ReactNode;
  /** Its status pill, beside the name. */
  status?: ReactNode;
  /** A short note beside the status, e.g. "You" on your own staff record. */
  note?: ReactNode;
  /** One line under the name, e.g. "Bole → Piassa · Public · added Oct 4, 2026". */
  summary?: ReactNode;
  /** The visible buttons: Edit, and a record's likely next step (Reactivate). */
  actions?: ReactNode;
  /** The rest, behind "⋯" (<ActionsMenu>). */
  menu: ReactNode;
};

/**
 * A record's header (GZW-077; design-system.md, "Detail panel / page"): "← All …" on a page, then
 * a row pinned to the top while the record scrolls – its name, status, buttons, the "⋯" menu and
 * in a panel the close button – then a summary line. Every detail starts with it, so a record's
 * actions are always one click away however long it is.
 */
export function DetailHeader({
  layout: { variant, headingId, backLink, closeButton },
  title,
  status,
  note,
  summary,
  actions,
  menu,
}: DetailHeaderProps) {
  const [row, stuck] = useStuck();
  // Set by the "⋯" menu's Copy link when the clipboard refuses; shown under the row, not in it.
  const [copyFailed, setCopyFailed] = useState(false);

  // Children of the detail itself (its <article> or panel, a grid with gap-6), not of a wrapper:
  // a sticky element only stays in view within its parent, so the parent must be the whole
  // record. Negative margins pull the parts closer than the detail's gap.
  return (
    <>
      {backLink && <div className="-mb-4">{backLink}</div>}
      <div
        ref={row}
        data-slot="detail-header-row"
        data-stuck={stuck ? "" : undefined}
        className={cn(
          "sticky z-20 -my-2 flex flex-wrap items-center gap-x-3 gap-y-2 py-2 transition-shadow duration-150",
          "data-stuck:border-b data-stuck:border-line data-stuck:shadow-sm",
          variant === "panel"
            ? // The panel scrolls itself, and pins inside its padding: up by the padding (p-6) to
              // its top edge.
              "-top-6 -mx-6 bg-surface px-6"
            : // Below the phone top bar (h-14); from lg there's none.
              "top-14 -mx-4 bg-canvas px-4 md:-mx-8 md:px-8 lg:top-0",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <DetailHeading id={headingId} variant={variant}>
            {title}
          </DetailHeading>
          {status}
          {note}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 *:data-[slot=button]:h-9 *:data-[slot=button]:px-3.5 *:data-[slot=button]:text-table">
          {actions}
          <NoticeContext value={setCopyFailed}>{menu}</NoticeContext>
          {closeButton}
        </div>
      </div>
      {summary && (
        <p data-slot="detail-summary" className="-mt-4 text-table text-muted">
          {summary}
        </p>
      )}
      {copyFailed && <CopyFailedNotice className="-mt-4" />}
    </>
  );
}

/**
 * Whether the row is pinned: what follows it in the record has moved up under it (at rest it
 * starts right at the row's bottom). Checked on every scroll (of the page or of the panel) and
 * resize, so it holds at any width and in any scroller.
 */
function useStuck() {
  const row = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(false);
  useEffect(() => {
    function check() {
      const next = row.current?.nextElementSibling;
      if (!row.current || !next) return;
      setValue(
        next.getBoundingClientRect().top <
          row.current.getBoundingClientRect().bottom - 1,
      );
    }
    check();
    // Capture: a panel's own scrolling doesn't bubble to the window.
    const options = { capture: true, passive: true };
    window.addEventListener("scroll", check, options);
    window.addEventListener("resize", check, options);
    return () => {
      window.removeEventListener("scroll", check, options);
      window.removeEventListener("resize", check, options);
    };
  }, []);
  return [row, value] as const;
}
