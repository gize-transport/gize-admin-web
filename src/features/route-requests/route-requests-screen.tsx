"use client";

import { InboxIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import {
  createDataTableColumnHelper,
  DataTable,
  FilterChips,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { isNotFound } from "@/components/detail/detail-frame";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { RouteFilter } from "@/components/pickers/route-filter";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { useArea } from "@/features/areas/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import {
  useRouteRequests,
  type RequestKind,
  type RequestStatus,
} from "./queries";
import { RouteRequestDetail } from "./route-request-detail";
import { RouteRequestFormDialog } from "./route-request-form-dialog";
import { AskedFor, RequestStatusPill, riderLabel } from "./request-labels";

type RouteRequestRead = components["schemas"]["RouteRequestRead"];

const col = createDataTableColumnHelper<RouteRequestRead>();

const STATUSES: RequestStatus[] = ["new", "matched", "fulfilled", "declined"];
const KINDS: RequestKind[] = ["new_areas", "route"];
const AREA_FILTERS = [
  "from_area_id",
  "from_area_name",
  "to_area_id",
  "to_area_name",
];
const FILTERS = ["status", "kind", "open", "route_id", ...AREA_FILTERS];

/** A value from the URL if it's one of `allowed`; anything else is no filter. */
function oneOf<T extends string>(value: string | null, allowed: T[]) {
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * Route requests (GZW-040): oldest first, with status, kind, open and route filters, and the area
 * pair a Demand card opens (GZW-045); staff record them. No search by name or phone: the API has none, and phones never go in URLs. A request's
 * details are its own page (`/route-requests/[id]`); on wide screens a row opens them in a side
 * panel instead. Contact details only show on the detail.
 */
export function RouteRequestsScreen() {
  const t = useTranslations("RouteRequests");
  const tStatus = useTranslations("RequestStatus");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const { cursor, get, setFilters } = useListParams();
  const detail = useDetailPanel({
    param: "request",
    basePath: "/route-requests",
  });
  const open = get("open");
  const filters = {
    status: oneOf(get("status"), STATUSES),
    kind: oneOf(get("kind"), KINDS),
    open: open === "true" ? true : open === "false" ? false : null,
    routeId: get("route_id") || null,
    fromAreaId: get("from_area_id") || null,
    fromAreaName: get("from_area_name") || null,
    toAreaId: get("to_area_id") || null,
    toAreaName: get("to_area_name") || null,
    cursor,
  };
  const requests = useRouteRequests(filters);
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("rider_name", {
          header: t("colRider"),
          cell: (info) => (
            <span className="grid gap-0.5">
              <RowAction {...detail.rowLink(info.row.original.id)}>
                {info.getValue()}
              </RowAction>
              <span className="text-meta text-muted">
                {riderLabel(info.row.original, t)}
              </span>
            </span>
          ),
        }),
        col.display({
          id: "asked",
          header: t("colAsked"),
          cell: (info) => (
            <span className="grid gap-0.5">
              <span>
                <AskedFor request={info.row.original} />
              </span>
              <span className="text-meta text-muted">
                {t(
                  info.row.original.kind === "route"
                    ? "kindRoute"
                    : "kindNewAreas",
                )}
              </span>
            </span>
          ),
        }),
        col.accessor("status", {
          header: t("colStatus"),
          cell: (info) => <RequestStatusPill request={info.row.original} />,
        }),
        col.accessor("created_at", {
          header: t("colRecorded"),
          cell: (info) => (
            <span className="whitespace-nowrap">{date(info.getValue())}</span>
          ),
        }),
      ]),
    [t, detail, date],
  );

  const addButton = (
    <Button onClick={openForm}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  if (isForbidden(requests.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const pairFiltered =
    filters.fromAreaId !== null ||
    filters.fromAreaName !== null ||
    filters.toAreaId !== null ||
    filters.toAreaName !== null;
  const filtered =
    filters.status !== null ||
    filters.kind !== null ||
    filters.open !== null ||
    filters.routeId !== null ||
    pairFiltered;
  // A filter the API can't read (a hand-edited address): nothing matches, offer to clear it.
  const badFilter =
    filtered &&
    requests.error instanceof ApiError &&
    requests.error.code === "VALIDATION_FAILED";
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={addButton}
      />
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <FilterChips
            param="open"
            label={t("openFilter")}
            options={[
              { value: "true", label: t("filterOpen") },
              { value: "false", label: t("filterClosed") },
            ]}
          />
          <FilterChips
            param="kind"
            label={t("kindFilter")}
            options={[
              { value: "new_areas", label: t("kindNewAreas") },
              { value: "route", label: t("kindRoute") },
            ]}
          />
        </div>
        <FilterChips
          param="status"
          label={t("statusFilter")}
          options={STATUSES.map((status) => ({
            value: status,
            label: tStatus(status === "matched" ? "matchedAny" : status),
          }))}
        />
        <div className="grid items-start gap-4 lg:max-w-md">
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
        </div>
        {pairFiltered && (
          <PairFilter
            from={{ id: filters.fromAreaId, name: filters.fromAreaName }}
            to={{ id: filters.toAreaId, name: filters.toAreaName }}
            onClear={() =>
              setFilters(
                Object.fromEntries(AREA_FILTERS.map((key) => [key, null])),
              )
            }
          />
        )}
      </div>
      <div
        className={
          detail.panelId
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]"
            : "grid"
        }
      >
        <DataTable
          label={t("tableLabel")}
          columns={columns}
          data={badFilter ? [] : requests.data?.items}
          getRowId={(request) => request.id}
          isLoading={requests.isPending}
          nextCursor={requests.data?.next_cursor ?? null}
          selectedRowId={detail.panelId}
          error={
            requests.isError && !badFilter ? (
              <ProblemAlert
                message={message(requests.error)}
                requestId={
                  requests.error instanceof ApiError
                    ? requests.error.requestId
                    : null
                }
                retryAfterSeconds={
                  requests.error instanceof ApiError
                    ? requests.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void requests.refetch()}
              />
            ) : undefined
          }
          emptyState={
            filtered ? (
              <EmptyState
                icon={<InboxIcon aria-hidden />}
                title={t("noMatchesTitle")}
                description={t("noMatchesDescription")}
                action={
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFilters(
                        Object.fromEntries(FILTERS.map((key) => [key, null])),
                      )
                    }
                  >
                    {t("clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<InboxIcon aria-hidden />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={addButton}
              />
            )
          }
        />
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <RouteRequestDetail
              key={detail.panelId}
              requestId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
              onDeleted={detail.closeAfterDelete}
            />
          </div>
        )}
      </div>

      {formKey !== null && (
        <RouteRequestFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          onRecorded={(added) => detail.openPanel(added.id)}
        />
      )}
    </>
  );
}

type PairEnd = { id: string | null; name: string | null };

/**
 * The area pair a Demand card opened (GZW-045), from the address: each end a listed area (its id,
 * its name loaded) or a name typed as not listed. There's no picker for it here: it comes from
 * Demand, and "Show all areas" clears it.
 */
function PairFilter({
  from,
  to,
  onClear,
}: {
  from: PairEnd;
  to: PairEnd;
  onClear: () => void;
}) {
  const t = useTranslations("RouteRequests");
  const labelId = useId();
  const fromName = useEndName(from);
  const toName = useEndName(to);
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <p className="grid gap-0.5">
        <span id={labelId} className="text-table font-semibold text-ink">
          {t("areasFilter")}
        </span>
        <span className="text-body text-ink">
          {t("pairFilter", { from: fromName, to: toName })}
        </span>
      </p>
      <Button variant="secondary" size="sm" onClick={onClear}>
        {t("clearAreas")}
      </Button>
    </div>
  );
}

/** How an end of the pair reads: its area's name (loaded), the typed name, or any area. */
function useEndName(end: PairEnd) {
  const t = useTranslations("RouteRequests");
  const area = useArea(end.id);
  if (end.id !== null) {
    if (area.data) return area.data.name;
    if (area.isError) {
      return isNotFound(area.error) ? t("areaUnknown") : t("areaUnavailable");
    }
    return t("loadingName");
  }
  if (end.name !== null) return t("notListed", { name: end.name });
  return t("anyArea");
}
