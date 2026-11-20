"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useListParams } from "@/components/data-table";
import { useMediaQuery } from "@/lib/use-media-query";
import { focusDetailWhenOpened } from "./detail-frame";

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
  recordParams = NONE,
}: {
  param: string;
  basePath: string;
  /**
   * Params that belong to the open record (a route's `tab`): cleared when the panel closes, and
   * taken along to the record's page on a narrow screen.
   */
  recordParams?: readonly string[];
}) {
  const router = useRouter();
  const { get, setParams } = useListParams();
  const selectedId = get(param) || null;
  const wide = useMediaQuery(PANEL_QUERY);

  // Only when the link is opened: narrowing the window later just hides the panel (an open form
  // in it isn't thrown away), and widening shows it again. Not while the width is unknown
  // (hydration), or a wide screen would be sent to the page.
  const checkedWidth = useRef(false);
  // The open record's own params, as a query for its page ("tab=offers").
  const kept = new URLSearchParams();
  for (const key of recordParams) {
    const value = get(key);
    if (value !== null) kept.set(key, value);
  }
  const recordQuery = kept.toString();
  useEffect(() => {
    if (wide === null || checkedWidth.current) return;
    checkedWidth.current = true;
    if (selectedId && !wide) {
      router.replace(
        `${basePath}/${encodeURIComponent(selectedId)}${recordQuery ? `?${recordQuery}` : ""}`,
      );
    }
  }, [selectedId, wide, router, basePath, recordQuery]);

  // Back to the row that opened the panel (WCAG 2.4.3), once the navigation that closes it has
  // rendered; after a delete (the row is gone), to the page content.
  const focusAfterClose = useRef<{ row: string } | "content" | null>(null);
  useEffect(() => {
    const target = focusAfterClose.current;
    if (target === null || selectedId !== null) return;
    focusAfterClose.current = null;
    // The row may not be in the list (a record opened from another, outside the filters).
    const row =
      target === "content"
        ? null
        : document.querySelector<HTMLElement>(
            `[data-row-action][href="${basePath}/${CSS.escape(target.row)}"]`,
          );
    (row ?? document.getElementById("content"))?.focus();
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
        focusAfterClose.current = selectedId ? { row: selectedId } : null;
        setParams({ [param]: null, ...cleared(recordParams) });
      },
      /**
       * Shows another record (e.g. one just made): in the panel, or below the panel's width its
       * page, whose heading then takes focus.
       */
      openPanel(id: string) {
        if (wide === true) {
          setParams({ [param]: id });
          return;
        }
        focusDetailWhenOpened(id);
        router.push(`${basePath}/${encodeURIComponent(id)}`);
      },
      /** After the record is deleted: replaced, so Back doesn't reopen it. */
      closeAfterDelete() {
        focusAfterClose.current = "content";
        setParams(
          { [param]: null, ...cleared(recordParams) },
          { replace: true },
        );
      },
    }),
    [
      panelOpen,
      selectedId,
      wide,
      setParams,
      param,
      basePath,
      router,
      recordParams,
    ],
  );
}

const NONE: readonly string[] = [];

function cleared(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, null]));
}
