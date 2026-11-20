"use client";

import { PhoneIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  ClearFilters,
  FilterMenu,
  ListToolbar,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { SearchHint } from "@/components/search-field";
import { RouteFilter } from "@/components/pickers/route-filter";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { mobileE164, PHONE_TYPED_MAX } from "@/lib/phone";
import {
  useRiders,
  useRidersByPhone,
  type RiderType,
  type SeatState,
} from "./queries";
import { RiderDetail } from "./rider-detail";
import { RiderFormDialog } from "./rider-form-dialog";
import { planLabel, riderTypeLabel, SeatSummary } from "./rider-labels";

type RiderListItem = components["schemas"]["RiderListItem"];

const col = createDataTableColumnHelper<RiderListItem>();

const TYPES: RiderType[] = ["adult", "student", "corporate"];
const SEATS: SeatState[] = ["active", "reserved", "none"];
const FILTERS = ["type", "seat", "route_id"];
const SEARCH_DELAY_MS = 300;
/** In the address while a name search is on (its pages are that search's): never the name. */
const SEARCHED = "searched";
/** The API's limit for a name search (`q`). */
const NAME_MAX = 100;

/** A value from the URL if it's one of `allowed`; anything else is no filter. */
function oneOf<T extends string>(value: string | null, allowed: T[]) {
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * What the search box holds: nothing, the start of a name, a whole phone number (as the API
 * stores it), or digits that aren't a whole number yet.
 */
export type RiderSearch =
  | { kind: "none" }
  | { kind: "name"; name: string }
  | { kind: "phone"; phone: string }
  | { kind: "partial-phone" };

/** Letters (any script) make it a name; digits and the separators people type make it a phone. */
export function readSearch(text: string): RiderSearch {
  const value = text.trim();
  if (!value) return { kind: "none" };
  if (/^[0-9\s+().-]+$/.test(value) && /[0-9]/.test(value)) {
    const phone = mobileE164(value);
    return phone ? { kind: "phone", phone } : { kind: "partial-phone" };
  }
  return { kind: "name", name: value.slice(0, NAME_MAX) };
}

const sameSearch = (a: RiderSearch, b: RiderSearch) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Riders (GZW-030): newest first, with type, seat and route filters, and one search box for a name
 * or a phone number. What's typed stays on the page, never in its address: names and phones are
 * personal data, and a phone is looked up with a POST (`riders_lookup`). A rider's details are
 * their own page (`/riders/[id]`); on wide screens a row opens them in a side panel instead.
 * Phones show in full only on the detail.
 */
export function RidersScreen() {
  const t = useTranslations("Riders");
  const { message } = useApiErrorMessages();
  const { cursor, get, setFilters, setParams } = useListParams();
  const detail = useDetailPanel({ param: "rider", basePath: "/riders" });
  const [search, setSearch] = useState<RiderSearch>({ kind: "none" });
  // The cursor in the address belongs to the search that paged to it, but the search itself
  // isn't kept there. A cursor left over from another search (one just replaced, or one this
  // page no longer has after Back or a reload: `searched` says there was one) is never sent;
  // it's cleared from the address meanwhile (changeSearch).
  const [staleCursor, setStaleCursor] = useState<string | null>(() =>
    get(SEARCHED) ? cursor : null,
  );
  if (staleCursor !== null && cursor !== staleCursor) setStaleCursor(null);
  const filters = {
    name: search.kind === "name" ? search.name : null,
    riderType: oneOf(get("type"), TYPES),
    seat: oneOf(get("seat"), SEATS),
    routeId: get("route_id") || null,
    cursor: cursor !== null && cursor === staleCursor ? null : cursor,
  };
  const phoneSearch = search.kind === "phone";
  const partialPhone = search.kind === "partial-phone";
  const riders = useRiders(filters, !phoneSearch && !partialPhone);
  const byPhone = useRidersByPhone(phoneSearch ? search.phone : null);
  const [form, setForm] = useState<{ key: number; phone: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm(phone = "") {
    setForm((current) => ({ key: (current?.key ?? 0) + 1, phone }));
    setFormOpen(true);
  }

  function changeSearch(next: RiderSearch) {
    const changed = !sameSearch(next, search);
    if (changed) setSearch(next);
    // A name search marks the address (no name in it), so its pages aren't read without it.
    const searched = next.kind === "name" ? "1" : null;
    // Another search starts again from the first page; so does a page from a search gone.
    const dropCursor =
      cursor !== null &&
      (changed || (get(SEARCHED) !== null && search.kind === "none"));
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
              <span className="grid gap-0.5">
                <RowAction {...detail.rowLink(info.row.original.id)}>
                  {info.getValue()}
                </RowAction>
                {info.row.original.phone_masked && (
                  <span className="font-mono text-meta text-muted">
                    {info.row.original.phone_masked}
                  </span>
                )}
              </span>
            </CellWithPicture>
          ),
        }),
        col.accessor("rider_type", {
          header: t("colType"),
          cell: (info) => (
            <span className="grid gap-0.5">
              <span>{riderTypeLabel(info.getValue(), t)}</span>
              {info.row.original.company && (
                <span className="text-meta text-muted">
                  {info.row.original.company.name}
                </span>
              )}
            </span>
          ),
        }),
        col.display({
          id: "seat",
          header: t("colSeat"),
          cell: (info) => <SeatSummary rider={info.row.original} />,
        }),
        col.display({
          id: "plan",
          header: t("colPlan"),
          cell: (info) =>
            planLabel(info.row.original, t) ?? (
              <span className="text-muted">
                {t(
                  info.row.original.rider_type === "corporate"
                    ? "planCompany"
                    : "notSet",
                )}
              </span>
            ),
        }),
        col.display({
          id: "boards",
          header: t("colBoards"),
          cell: (info) =>
            info.row.original.home_area?.name ?? (
              <span className="text-muted">{t("notSet")}</span>
            ),
        }),
        col.accessor("open_requests", {
          header: t("colRequests"),
          cell: (info) => (
            <span className="tabular-nums">{info.getValue()}</span>
          ),
        }),
      ]),
    [t, detail],
  );

  const addButton = (
    <Button onClick={() => openForm()}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  const shown = phoneSearch ? byPhone : riders;
  if (isForbidden(shown.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered =
    filters.riderType !== null ||
    filters.seat !== null ||
    filters.routeId !== null;
  // A filter the API can't read (a hand-edited address): nothing matches, offer to clear it.
  const badFilter =
    !phoneSearch &&
    filtered &&
    riders.error instanceof ApiError &&
    riders.error.code === "VALIDATION_FAILED";
  const clearFilters = () =>
    setFilters(Object.fromEntries(FILTERS.map((key) => [key, null])));

  let emptyState = (
    <EmptyState
      icon={<UsersIcon aria-hidden />}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={addButton}
    />
  );
  if (partialPhone) {
    emptyState = (
      <EmptyState
        icon={<PhoneIcon aria-hidden />}
        title={t("partialPhoneTitle")}
        description={t("partialPhoneDescription")}
      />
    );
  } else if (phoneSearch) {
    emptyState = (
      <EmptyState
        icon={<PhoneIcon aria-hidden />}
        title={t("noPhoneMatchTitle")}
        description={t("noPhoneMatchDescription")}
        action={
          <Button onClick={() => openForm(search.phone)}>
            <PlusIcon aria-hidden />
            {t("addWithPhone")}
          </Button>
        }
      />
    );
  } else if (search.kind === "name" || filtered) {
    emptyState = (
      <EmptyState
        icon={<SearchIcon aria-hidden />}
        title={t("noMatchesTitle")}
        description={t(
          search.kind === "name"
            ? "noMatchesSearchDescription"
            : "noMatchesDescription",
        )}
        action={
          filtered ? (
            <Button variant="secondary" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div
        className={
          detail.panelId
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]"
            : "grid"
        }
      >
        {/* One table for every search: its toolbar holds the search box, which must stay. */}
        <DataTable
          toolbar={
            <ListToolbar
              action={addButton}
              below={
                phoneSearch && (
                  <p className="text-table text-muted">
                    {t("phoneSearchNote")}
                  </p>
                )
              }
            >
              <RiderSearchField onSearch={changeSearch} />
              <FilterMenu
                param="type"
                label={t("typeFilter")}
                options={TYPES.map((value) => ({
                  value,
                  label: riderTypeLabel(value, t),
                }))}
              />
              <FilterMenu
                param="seat"
                label={t("seatFilter")}
                options={[
                  { value: "active", label: t("seatRiding") },
                  { value: "reserved", label: t("seatReserved") },
                  { value: "none", label: t("noSeat") },
                ]}
              />
              <RouteFilter
                routeId={filters.routeId}
                labels={{
                  label: t("routeFilter"),
                  anyRoute: t("anyRoute"),
                  loading: t("loadingName"),
                  unknownRoute: t("unknownRoute"),
                  routeUnavailable: t("routeUnavailable"),
                }}
              />
              <ClearFilters params={FILTERS} />
            </ListToolbar>
          }
          label={t("tableLabel")}
          columns={columns}
          data={
            badFilter || partialPhone
              ? []
              : phoneSearch
                ? byPhone.data?.items
                : riders.data?.items
          }
          getRowId={(rider) => rider.id}
          // Part of a phone number is never looked up: nothing loads.
          isLoading={!partialPhone && shown.isPending}
          nextCursor={
            phoneSearch || partialPhone
              ? null
              : (riders.data?.next_cursor ?? null)
          }
          selectedRowId={detail.panelId}
          error={
            shown.isError && !badFilter && !partialPhone ? (
              <ProblemAlert
                message={message(shown.error)}
                requestId={
                  shown.error instanceof ApiError ? shown.error.requestId : null
                }
                retryAfterSeconds={
                  shown.error instanceof ApiError
                    ? shown.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void shown.refetch()}
              />
            ) : undefined
          }
          emptyState={emptyState}
        />
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <RiderDetail
              key={detail.panelId}
              riderId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
              onDeleted={detail.closeAfterDelete}
            />
          </div>
        )}
      </div>

      {form !== null && (
        <RiderFormDialog
          key={form.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          initialPhone={form.phone}
          onRecorded={(added) => detail.openPanel(added.id)}
        />
      )}
    </>
  );
}

/**
 * The "Name or phone" box. Its text is this page's alone: written to no URL and no storage. It
 * searches after a short pause in typing, or at once when the box loses focus.
 */
function RiderSearchField({
  onSearch,
}: {
  onSearch: (search: RiderSearch) => void;
}) {
  const t = useTranslations("Riders");
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
    // A toolbar's search (GZW-076): see SearchField.
    <div className="group relative w-full sm:w-64">
      <Label htmlFor={`${uid}-search`} className="sr-only">
        {t("searchLabel")}
      </Label>
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
          maxLength={Math.max(NAME_MAX, PHONE_TYPED_MAX)}
          autoComplete="off"
          className="h-9 pl-9 text-table"
        />
      </div>
      <SearchHint id={`${uid}-search-hint`}>{t("searchHint")}</SearchHint>
    </div>
  );
}
