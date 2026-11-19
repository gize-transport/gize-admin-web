"use client";

import { PlusIcon, SearchIcon, TruckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  FilterChips,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { DriverDetail } from "./driver-detail";
import { DriverFormDialog } from "./driver-form-dialog";
import { useDrivers } from "./queries";

type DriverRead = components["schemas"]["DriverRead"];

const col = createDataTableColumnHelper<DriverRead>();

const SEARCH_DELAY_MS = 300;
/** In the address while a search is on (its pages are that search's): never what was typed. */
const SEARCHED = "searched";
/** The API's limit for a search (`q`). */
const SEARCH_MAX = 100;

/** "true" / "false" in the URL; anything else is no filter. */
function activeFilter(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/** What's searched for: the start of a name or plate, or "" for nothing. */
const readSearch = (text: string) => text.trim().slice(0, SEARCH_MAX);

/**
 * Drivers (GZW-050): newest first, a status filter, and one search box for the start of a name
 * or plate. What's typed stays on the page, never in its address (names are personal data). A
 * driver's details are their own page (`/drivers/[id]`); on wide screens a row opens them in a
 * side panel instead.
 */
export function DriversScreen() {
  const t = useTranslations("Drivers");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const { cursor, get, setFilters, setParams } = useListParams();
  const detail = useDetailPanel({ param: "driver", basePath: "/drivers" });
  const [search, setSearch] = useState("");
  // The cursor in the address belongs to the search that paged to it, but the search itself
  // isn't kept there. A cursor left over from another search (one just replaced, or one this
  // page no longer has after Back or a reload: `searched` says there was one) is never sent;
  // it's cleared from the address meanwhile (changeSearch).
  const [staleCursor, setStaleCursor] = useState<string | null>(() =>
    get(SEARCHED) ? cursor : null,
  );
  if (staleCursor !== null && cursor !== staleCursor) setStaleCursor(null);
  const isActive = activeFilter(get("is_active"));
  const drivers = useDrivers({
    q: search || null,
    isActive,
    cursor: cursor !== null && cursor === staleCursor ? null : cursor,
  });
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  function changeSearch(next: string) {
    const changed = next !== search;
    if (changed) setSearch(next);
    // A search marks the address (without what was typed), so its pages aren't read without it.
    const searched = next ? "1" : null;
    // Another search starts again from the first page; so does a page from a search gone.
    const dropCursor =
      cursor !== null && (changed || (get(SEARCHED) !== null && !search));
    if (dropCursor) setStaleCursor(cursor);
    if (dropCursor || get(SEARCHED) !== searched) {
      setParams(
        { [SEARCHED]: searched, ...(dropCursor ? { cursor: null } : {}) },
        { replace: true },
      );
    }
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("full_name", {
          header: t("colName"),
          cell: (info) => (
            <CellWithPicture picture={<Avatar name={info.getValue()} />}>
              <RowAction {...detail.rowLink(info.row.original.id)}>
                {info.getValue()}
              </RowAction>
            </CellWithPicture>
          ),
        }),
        col.accessor("plate", {
          header: t("colPlate"),
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        col.accessor("phone", {
          header: t("colPhone"),
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        col.accessor("is_active", {
          header: t("colStatus"),
          cell: (info) =>
            info.getValue() ? (
              <StatusPill tone="success">{t("active")}</StatusPill>
            ) : (
              <StatusPill tone="neutral">{t("inactive")}</StatusPill>
            ),
        }),
        col.accessor("created_at", {
          header: t("colAdded"),
          cell: (info) => date(info.getValue()),
        }),
      ]),
    [t, date, detail],
  );

  const addButton = (
    <Button onClick={openForm}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  if (isForbidden(drivers.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  let emptyState = (
    <EmptyState
      icon={<TruckIcon aria-hidden />}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={addButton}
    />
  );
  if (search || isActive !== null) {
    emptyState = (
      <EmptyState
        icon={<SearchIcon aria-hidden />}
        title={t("noMatchesTitle")}
        description={t(
          search ? "noMatchesSearchDescription" : "noMatchesDescription",
        )}
        action={
          isActive !== null ? (
            <Button
              variant="secondary"
              onClick={() => setFilters({ is_active: null })}
            >
              {t("clearFilters")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={addButton}
      />
      <div
        className={
          detail.panelId
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "grid"
        }
      >
        <DataTable
          label={t("tableLabel")}
          columns={columns}
          data={drivers.data?.items}
          getRowId={(driver) => driver.id}
          isLoading={drivers.isPending}
          nextCursor={drivers.data?.next_cursor ?? null}
          selectedRowId={detail.panelId}
          toolbar={
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <DriverSearchField onSearch={changeSearch} />
              <FilterChips
                param="is_active"
                label={t("statusFilter")}
                options={[
                  { value: "true", label: t("filterActive") },
                  { value: "false", label: t("filterInactive") },
                ]}
              />
            </div>
          }
          error={
            drivers.isError ? (
              <ProblemAlert
                message={message(drivers.error)}
                requestId={
                  drivers.error instanceof ApiError
                    ? drivers.error.requestId
                    : null
                }
                retryAfterSeconds={
                  drivers.error instanceof ApiError
                    ? drivers.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void drivers.refetch()}
              />
            ) : undefined
          }
          emptyState={emptyState}
        />
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <DriverDetail
              key={detail.panelId}
              driverId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
              onDeleted={detail.closeAfterDelete}
            />
          </div>
        )}
      </div>

      {formKey !== null && (
        <DriverFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          onAdded={(added) => detail.openPanel(added.id)}
        />
      )}
    </>
  );
}

/**
 * The "Name or plate" box. Its text is this page's alone: written to no URL and no storage. It
 * searches after a short pause in typing, or at once when the box loses focus.
 */
function DriverSearchField({
  onSearch,
}: {
  onSearch: (search: string) => void;
}) {
  const t = useTranslations("Drivers");
  // Unique ids: Next can keep earlier pages in the document (see SearchField).
  const uid = useId();
  const [text, setText] = useState("");
  // The latest callback, so a new one (each render of the screen) doesn't restart the pause.
  const latest = useRef(onSearch);
  useEffect(() => {
    latest.current = onSearch;
  });

  useEffect(() => {
    const timer = setTimeout(
      () => latest.current(readSearch(text)),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor={`${uid}-search`}>{t("searchLabel")}</Label>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          id={`${uid}-search`}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => onSearch(readSearch(text))}
          placeholder={t("searchPlaceholder")}
          aria-describedby={`${uid}-search-hint`}
          maxLength={SEARCH_MAX}
          autoComplete="off"
          className="pl-9"
        />
      </div>
      <p id={`${uid}-search-hint`} className="text-table text-muted">
        {t("searchHint")}
      </p>
    </div>
  );
}
