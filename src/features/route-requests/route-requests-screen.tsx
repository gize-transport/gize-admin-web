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
import { RoutePicker } from "@/components/pickers/route-picker";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRoute } from "@/features/routes/queries";
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
type RouteRef = components["schemas"]["RouteRef"];

const col = createDataTableColumnHelper<RouteRequestRead>();

const STATUSES: RequestStatus[] = ["new", "matched", "fulfilled", "declined"];
const KINDS: RequestKind[] = ["new_areas", "route"];
const FILTERS = ["status", "kind", "open", "route_id"];

/** A value from the URL if it's one of `allowed`; anything else is no filter. */
function oneOf<T extends string>(value: string | null, allowed: T[]) {
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * Route requests (GZW-040): oldest first, with status, kind, open and route filters; staff record
 * them. No search by name or phone: the API has none, and phones never go in URLs. A request's
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

  const filtered =
    filters.status !== null ||
    filters.kind !== null ||
    filters.open !== null ||
    filters.routeId !== null;
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
          <RouteFilter routeId={filters.routeId} />
        </div>
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

/** The route filter (requests asking for it or matched to it), kept in the URL as its id. */
function RouteFilter({ routeId }: { routeId: string | null }) {
  const t = useTranslations("RouteRequests");
  // Unique ids: Next can keep earlier pages in the document (see SearchField).
  const uid = useId();
  const { setFilter } = useListParams();
  const [picked, setPicked] = useState<RouteRef | null>(null);
  const known = picked !== null && picked.id === routeId ? picked : null;
  const route = useRoute(known === null ? routeId : null);

  let value: RouteRef | null = known;
  if (routeId !== null && known === null && route.data) {
    value = { id: route.data.id, code: route.data.code };
  }
  const unknown = routeId !== null && known === null && route.isError;
  const loading = routeId !== null && value === null && !unknown;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${uid}-route`}>{t("routeFilter")}</Label>
      <RoutePicker
        id={`${uid}-route`}
        value={value}
        placeholder={t(loading ? "loadingName" : "anyRoute")}
        aria-describedby={unknown ? `${uid}-route-unknown` : undefined}
        onChange={(next) => {
          setPicked(next);
          setFilter("route_id", next?.id ?? null);
        }}
      />
      {unknown && (
        <p id={`${uid}-route-unknown`} className="text-table text-muted">
          {t(isNotFound(route.error) ? "unknownRoute" : "routeUnavailable")}
        </p>
      )}
    </div>
  );
}
