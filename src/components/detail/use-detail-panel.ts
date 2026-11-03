"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useListParams } from "@/components/data-table";
import { useMediaQuery } from "@/lib/use-media-query";

/** From this width a record's details open beside the list (design-system.md, "DataTable"). */
const PANEL_QUERY = "(min-width: 1280px)";

/**
 * The list side of the detail pattern: a row's link goes to the record's page
 * (`${basePath}/${id}`); on wide screens it opens the record in a side panel instead, kept in the
 * list's URL (`?${param}=id`, so Back closes it). Focus returns to the row when the panel closes.
 * A panel link opened below the panel's width goes to the page.
 */
export function useDetailPanel({
  param,
  basePath,
}: {
  param: string;
  basePath: string;
}) {
  const router = useRouter();
  const { get, setParams } = useListParams();
  const selectedId = get(param) || null;
  const wide = useMediaQuery(PANEL_QUERY);

  // Only when the link is opened: narrowing the window later just hides the panel (an open form
  // in it isn't thrown away), and widening shows it again. Not while the width is unknown
  // (hydration), or a wide screen would be sent to the page.
  const checkedWidth = useRef(false);
  useEffect(() => {
    if (wide === null || checkedWidth.current) return;
    checkedWidth.current = true;
    if (selectedId && !wide) {
      router.replace(`${basePath}/${encodeURIComponent(selectedId)}`);
    }
  }, [selectedId, wide, router, basePath]);

  // Back to the row that opened the panel (WCAG 2.4.3), once the navigation that closes it has
  // rendered.
  const focusRowAfterClose = useRef<string | null>(null);
  useEffect(() => {
    const id = focusRowAfterClose.current;
    if (id === null || selectedId !== null) return;
    focusRowAfterClose.current = null;
    document
      .querySelector<HTMLElement>(
        `[data-row-action][href="${basePath}/${CSS.escape(id)}"]`,
      )
      ?.focus();
  }, [selectedId, basePath]);

  const panelOpen = wide === true && selectedId !== null;

  // Stable between renders (the table's columns depend on it: new cell functions would remount
  // every cell and drop keyboard focus on a row link).
  return useMemo(
    () => ({
      /** The record shown in the panel, when it is open. */
      panelId: panelOpen ? selectedId : null,
      /** Props for the row's RowAction. */
      rowLink(id: string) {
        return {
          href: `${basePath}/${id}`,
          current: panelOpen && id === selectedId,
          onNavigate(event: MouseEvent<HTMLAnchorElement>) {
            // New tabs and narrow screens follow the link to the page.
            const plainClick =
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey;
            if (wide !== true || !plainClick) return;
            event.preventDefault();
            setParams({ [param]: id });
          },
        };
      },
      closePanel() {
        focusRowAfterClose.current = selectedId;
        setParams({ [param]: null });
      },
      /** After the record is deleted: replaced, so Back doesn't reopen it. */
      closeAfterDelete() {
        setParams({ [param]: null }, { replace: true });
      },
    }),
    [panelOpen, selectedId, wide, setParams, param, basePath],
  );
}
