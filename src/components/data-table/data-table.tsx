"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type RowData,
  type TableOptions,
} from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useListParams } from "./use-list-params";

// Server-side lists: the API filters and paginates, so the table only needs the core row model.
const dataTableFeatures = tableFeatures({});
type DataTableFeatures = typeof dataTableFeatures;

/** Column helper for DataTable columns: `const col = createDataTableColumnHelper<Route>()`. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

type DataTableProps<TData extends RowData> = {
  /** Names the table and its scroll region for screen readers, e.g. "Routes". */
  label: string;
  columns: TableOptions<DataTableFeatures, TData>["columns"];
  /** One page of `items` from the API; undefined while the first load runs. */
  data: TData[] | undefined;
  getRowId: (row: TData) => string;
  isLoading?: boolean;
  /** A ProblemAlert, shown instead of the table. */
  error?: ReactNode;
  /** Shown instead of the table when the page has no rows; should offer the next action. */
  emptyState: ReactNode;
  /** The API's `next_cursor`. Leave undefined for lists that are not paginated. */
  nextCursor?: string | null;
  /** Highlights the row whose details are open. */
  selectedRowId?: string | null;
};

const SKELETON_ROWS = 5;
// Stable fallback, so TanStack doesn't rebuild the row model on every render while loading.
const NO_ROWS: never[] = [];

/**
 * List table from docs/design-system.md: sticky header and first column, horizontal scroll in a
 * focusable region on narrow screens, skeleton loading, empty state, URL-synced cursor pagination.
 * Put a RowAction in the first column: clicking anywhere else on the row activates it.
 *
 * Reads the URL (useSearchParams), so under `cacheComponents` it must sit inside a <Suspense>.
 */
export function DataTable<TData extends RowData>({
  label,
  columns,
  data,
  getRowId,
  isLoading = false,
  error,
  emptyState,
  nextCursor,
  selectedRowId,
}: DataTableProps<TData>) {
  const t = useTranslations("DataTable");
  const captionId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const previousCursor = useRef<string | null | undefined>(undefined);
  const focusAfterPaging = useRef(false);
  const { cursor } = useListParams();

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? NO_ROWS,
    getRowId: (row) => getRowId(row),
  });

  const rows = table.getRowModel().rows;
  // No data yet (first load, or a paused/disabled query) is shown as loading, never as "empty".
  const loading = !error && (isLoading || data === undefined);
  const showRows = !error && !loading && rows.length > 0;

  // Row click forwards to the row's RowAction, so mouse, keyboard and screen-reader users all get
  // the same control (the action is a real button or link in the first cell).
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !showRows) return;
    function forwardRowClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a, button, input, select, textarea, label")) return;
      if (window.getSelection()?.toString()) return;
      target
        .closest("tr")
        ?.querySelector<HTMLElement>("[data-row-action]")
        ?.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
          }),
        );
    }
    body.addEventListener("click", forwardRowClick);
    return () => body.removeEventListener("click", forwardRowClick);
  }, [showRows]);

  // Keep focused cells clear of the sticky header and the pinned first column (WCAG 2.4.11).
  useEffect(() => {
    const region = regionRef.current;
    const pinned = region?.querySelector("th");
    if (!region || !pinned) return;
    const observer = new ResizeObserver(() => {
      region.style.scrollPaddingTop = `${pinned.offsetHeight}px`;
      region.style.scrollPaddingLeft = `${pinned.offsetWidth}px`;
    });
    observer.observe(pinned);
    return () => observer.disconnect();
  }, [showRows, loading]);

  // A new page starts at the top of the table. Skipped on mount, so Back keeps the scroll position.
  useEffect(() => {
    if (previousCursor.current === undefined) {
      previousCursor.current = cursor;
      return;
    }
    if (previousCursor.current === cursor) return;
    previousCursor.current = cursor;
    const region = regionRef.current;
    if (region) region.scrollTop = 0;
    const card = cardRef.current;
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ block: "start" });
    }
  }, [cursor]);

  // After "Next page"/"First page" the link the user pressed may be gone (last page, loading), so
  // move focus to the table once the new page is shown (WCAG 2.4.3).
  useEffect(() => {
    if (!focusAfterPaging.current || loading) return;
    focusAfterPaging.current = false;
    (regionRef.current ?? cardRef.current)?.focus({ preventScroll: true });
  }, [cursor, loading]);

  const pagination = (
    <CursorPagination
      nextCursor={error ? null : nextCursor}
      onNavigate={() => {
        focusAfterPaging.current = true;
      }}
    />
  );
  const loadingStatus = (
    // Mounted from the start, so the "Loading…" text is announced when it appears.
    <p role="status" className="sr-only">
      {loading ? t("loading") : ""}
    </p>
  );

  if (error || (!loading && rows.length === 0)) {
    return (
      <TableCard ref={cardRef}>
        {loadingStatus}
        {error ?? emptyState}
        {/* With an error, still offer "First page" – e.g. for an expired cursor in a shared link. */}
        {pagination}
      </TableCard>
    );
  }

  const headerGroups = table.getHeaderGroups();
  const columnCount = headerGroups.at(-1)?.headers.length ?? 1;

  return (
    <TableCard ref={cardRef}>
      {loadingStatus}
      <div
        ref={regionRef}
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="relative overflow-auto rounded-xl md:max-h-[70dvh]"
      >
        <Table aria-busy={loading || undefined}>
          <TableCaption id={captionId} className="sr-only">
            {label}
          </TableCaption>
          <TableHeader>
            {headerGroups.map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header, index) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      "sticky top-0 z-10",
                      index === 0 && "left-0 z-20 max-md:border-r",
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody ref={bodyRef}>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: columnCount }, (_, index) => (
                      <TableCell
                        key={index}
                        className={cn(
                          index === 0 && "sticky left-0 z-5 max-md:border-r",
                        )}
                      >
                        <Skeleton className="h-4 w-full min-w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => {
                  const selected = row.id === selectedRowId;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={selected ? "selected" : undefined}
                      className="hover:bg-ice has-[[data-row-action]]:cursor-pointer"
                    >
                      {row.getAllCells().map((cell, index) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            index === 0 && "sticky left-0 z-5 max-md:border-r",
                            index === 0 &&
                              selected &&
                              "shadow-[inset_3px_0_0_var(--color-royal)]",
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
      {!loading && pagination}
    </TableCard>
  );
}

function TableCard({
  ref,
  children,
}: {
  ref: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    // min-w-0: inside grid/flex layouts the card must not grow to the table's width – the table
    // scrolls inside its region instead. Focusable from script only (focus after paging).
    <div
      ref={ref}
      tabIndex={-1}
      className="min-w-0 rounded-xl border border-line bg-surface"
    >
      {children}
    </div>
  );
}

function CursorPagination({
  nextCursor,
  onNavigate,
}: {
  nextCursor?: string | null;
  onNavigate: () => void;
}) {
  const t = useTranslations("DataTable");
  const { cursor, nextPageHref, firstPageHref } = useListParams();

  // undefined = this list isn't paginated.
  if (nextCursor === undefined || (!nextCursor && !cursor)) return null;

  const linkClass =
    "inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-table font-semibold text-navy transition-colors duration-150 hover:border-royal hover:bg-ice";

  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3"
    >
      {cursor && (
        <Link
          href={firstPageHref()}
          prefetch={false}
          scroll={false}
          onClick={onNavigate}
          className={linkClass}
        >
          {t("firstPage")}
        </Link>
      )}
      {nextCursor && (
        <Link
          href={nextPageHref(nextCursor)}
          prefetch={false}
          scroll={false}
          onClick={onNavigate}
          className={linkClass}
        >
          {t("nextPage")}
        </Link>
      )}
    </nav>
  );
}

type RowActionProps = {
  children: ReactNode;
  /** This row's details are open (announced as "current"). */
  current?: boolean;
  /**
   * Accessible name when the visible text alone doesn't say what happens (e.g. "Bole, rename").
   * Must start with the visible text (WCAG 2.5.3).
   */
  "aria-label"?: string;
} & (
  | { onSelect: () => void; href?: never; onNavigate?: never }
  | {
      href: string;
      onSelect?: never;
      /**
       * Before the link is followed; call `event.preventDefault()` to show the details another
       * way (e.g. a side panel on wide screens). The link stays a real link for new tabs.
       */
      onNavigate?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
    }
);

/** The row's main control, in the first column: opens the row's details. */
export function RowAction({
  children,
  current,
  onSelect,
  href,
  onNavigate,
  "aria-label": ariaLabel,
}: RowActionProps) {
  const className =
    "rounded-sm text-left font-semibold text-navy underline-offset-4 hover:underline";
  const shared = {
    "data-row-action": "",
    "aria-current": current ? ("true" as const) : undefined,
    "aria-label": ariaLabel,
    className,
  };

  return href ? (
    <Link href={href} onClick={onNavigate} {...shared}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onSelect} {...shared}>
      {children}
    </button>
  );
}
