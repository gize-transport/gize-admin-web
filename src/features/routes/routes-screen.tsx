"use client";

import { BusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import {
  createDataTableColumnHelper,
  DataTable,
  ClearFilters,
  FilterMenu,
  ListToolbar,
  RowAction,
  SortMenu,
  useListParams,
  useListSort,
} from "@/components/data-table";
import { isNotFound } from "@/components/detail/detail-frame";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
import { EmptyState } from "@/components/empty-state";
import { LaunchProgress } from "@/components/launch-progress";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { CompanyPicker } from "@/components/pickers/company-picker";
import { CorridorField } from "@/components/pickers/corridor-field";
import { ProblemAlert } from "@/components/problem-alert";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/features/companies/queries";
import { useCorridor } from "@/features/corridors/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import {
  useRoutes,
  type RouteStatusFilter,
  type RouteType,
  ROUTE_SORTS,
} from "./queries";
import { RouteCorridor } from "./route-corridor";
import { RouteDetail, typeLabel } from "./route-detail";
import { RouteFormDialog } from "./route-form-dialog";
import { RouteStatusPill } from "./route-status-pill";

type RouteRead = components["schemas"]["RouteRead"];
type CompanyRef = components["schemas"]["CompanyRef"];
type CorridorRef = components["schemas"]["CorridorRef"];

const col = createDataTableColumnHelper<RouteRead>();

const TYPES: RouteType[] = ["public", "student", "corporate"];
/** The Status filter's choices: "Ready to launch" (the Overview's count, GZ-083) under Forming. */
const STATUS_FILTERS: RouteStatusFilter[] = [
  "draft",
  "forming",
  "ready",
  "active",
  "paused",
];
const FILTERS = ["q", "route_type", "status", "corridor_id", "company_id"];

/** A value from the URL if it's one of `allowed`; anything else is no filter. */
function oneOf<T extends string>(value: string | null, allowed: T[]) {
  return allowed.includes(value as T) ? (value as T) : null;
}

/** The open route's tab (route-detail.tsx) goes with it: cleared on close, kept on its page. */
const ROUTE_PARAMS = ["tab"] as const;

/**
 * Routes (GZW-021): list with code search, type, status, corridor and company filters; add for
 * staff. A route's details are its own page (`/routes/[id]`); on wide screens a row opens them in
 * a side panel instead.
 */
export function RoutesScreen() {
  const t = useTranslations("Routes");
  const tStatus = useTranslations("RouteStatus");
  const tTable = useTranslations("DataTable");
  const { message } = useApiErrorMessages();
  const { cursor, get, setFilters } = useListParams();
  const detail = useDetailPanel({
    param: "route",
    basePath: "/routes",
    recordParams: ROUTE_PARAMS,
  });
  const filters = {
    q: get("q"),
    routeType: oneOf(get("route_type"), TYPES),
    status: oneOf(get("status"), STATUS_FILTERS),
    corridorId: get("corridor_id") || null,
    companyId: get("company_id") || null,
    sort: useListSort(ROUTE_SORTS),
    cursor,
  };
  const routes = useRoutes(filters);
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("code", {
          header: t("colRoute"),
          cell: (info) => (
            // No picture: the widest list, where Status must stay in view (GZW-074).
            <span className="grid gap-0.5">
              <RowAction {...detail.rowLink(info.row.original.id)}>
                <span className="font-mono">{info.getValue()}</span>
              </RowAction>
              <span className="text-meta text-muted">
                <RouteCorridor corridor={info.row.original.corridor} />
              </span>
            </span>
          ),
        }),
        col.display({
          id: "type",
          header: t("colType"),
          cell: (info) => typeLabel(info.row.original, t),
        }),
        col.display({
          id: "times",
          header: t("colTimes"),
          cell: (info) => {
            const route = info.row.original;
            const time = (value: string | null) => value ?? t("notSet");
            return (
              <span className="font-mono text-table">
                {t("timesShort", {
                  leaveA: route.morning_time,
                  arriveB: time(route.morning_arrival_time),
                  leaveB: route.return_time,
                  arriveA: time(route.return_arrival_time),
                })}
              </span>
            );
          },
        }),
        col.display({
          id: "seats",
          header: t("colSeats"),
          cell: (info) => {
            const route = info.row.original;
            return (
              <span className="grid gap-0.5 text-table">
                <span>
                  {t("seatsThisMonth", {
                    taken: route.seats_taken.this_month,
                    free: route.seats_free.this_month,
                  })}
                </span>
                <span className="text-muted">
                  {t("seatsNextMonth", {
                    taken: route.seats_taken.next_month,
                    free: route.seats_free.next_month,
                  })}
                </span>
              </span>
            );
          },
        }),
        col.accessor("driver", {
          header: t("colDriver"),
          cell: (info) => {
            const driver = info.getValue();
            return driver ? (
              driver.full_name
            ) : (
              <span className="text-muted">{t("notAssigned")}</span>
            );
          },
        }),
        col.accessor("status", {
          header: t("colStatus"),
          cell: (info) => {
            const route = info.row.original;
            // A forming route: its launch progress as a meter (design-system.md).
            return route.status === "forming" &&
              route.launch_minimum !== null ? (
              <span className="grid gap-1.5">
                <RouteStatusPill route={route} showProgress={false} />
                <LaunchProgress
                  reserved={route.reserved}
                  minimum={route.launch_minimum}
                />
              </span>
            ) : (
              <RouteStatusPill route={route} />
            );
          },
        }),
      ]),
    [t, detail],
  );

  const addButton = (
    <Button onClick={openForm}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  if (isForbidden(routes.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered =
    Boolean(filters.q) ||
    filters.routeType !== null ||
    filters.status !== null ||
    filters.corridorId !== null ||
    filters.companyId !== null;
  // A filter the API can't read (a hand-edited address): nothing matches, offer to clear it.
  const badFilter =
    filtered &&
    routes.error instanceof ApiError &&
    routes.error.code === "VALIDATION_FAILED";
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
        <DataTable
          toolbar={
            <ListToolbar action={addButton}>
              <SearchField
                param="q"
                label={t("searchLabel")}
                placeholder={t("searchHint")}
                maxLength={20}
              />
              <FilterMenu
                param="route_type"
                label={t("typeFilter")}
                options={[
                  { value: "public", label: t("typePublic") },
                  { value: "student", label: t("typeStudent") },
                  { value: "corporate", label: t("typeCorporate") },
                ]}
              />
              <FilterMenu
                param="status"
                label={t("statusFilter")}
                options={STATUS_FILTERS.map((status) => ({
                  value: status,
                  label:
                    status === "ready"
                      ? t("statusReady")
                      : status === "forming"
                        ? tStatus("formingNoMinimum")
                        : tStatus(status),
                }))}
              />
              <CorridorFilter corridorId={filters.corridorId} />
              <CompanyFilter companyId={filters.companyId} />
              <ClearFilters params={FILTERS} />
              <SortMenu
                options={[
                  { value: "newest", label: tTable("sortNewest") },
                  { value: "code", label: t("sortCode") },
                  { value: "morning_time", label: t("sortMorning") },
                ]}
              />
            </ListToolbar>
          }
          label={t("tableLabel")}
          columns={columns}
          data={badFilter ? [] : routes.data?.items}
          getRowId={(route) => route.id}
          isLoading={routes.isPending}
          nextCursor={routes.data?.next_cursor ?? null}
          selectedRowId={detail.panelId}
          error={
            routes.isError && !badFilter ? (
              <ProblemAlert
                message={message(routes.error)}
                requestId={
                  routes.error instanceof ApiError
                    ? routes.error.requestId
                    : null
                }
                retryAfterSeconds={
                  routes.error instanceof ApiError
                    ? routes.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void routes.refetch()}
              />
            ) : undefined
          }
          emptyState={
            filtered ? (
              <EmptyState
                icon={<BusIcon aria-hidden />}
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
                icon={<BusIcon aria-hidden />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={addButton}
              />
            )
          }
        />
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <RouteDetail
              key={detail.panelId}
              routeId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
              onDeleted={detail.closeAfterDelete}
              onOpenRoute={detail.openPanel}
            />
          </div>
        )}
      </div>

      {formKey !== null && (
        <RouteFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}
    </>
  );
}

/**
 * The corridor filter, kept in the URL as the corridor's id; picked as its two areas. After a
 * reload or a shared link the areas come from `corridors_get`.
 */
function CorridorFilter({ corridorId }: { corridorId: string | null }) {
  const t = useTranslations("Routes");
  // Unique ids: Next can keep earlier pages in the document (see SearchField).
  const uid = useId();
  const { setFilter } = useListParams();
  // The corridor just picked; the URL's other corridors (reload, shared link) come from the API.
  const [picked, setPicked] = useState<CorridorRef | null>(null);
  const known = picked !== null && picked.id === corridorId ? picked : null;
  const corridor = useCorridor(known === null ? corridorId : null);
  const value = corridorId === null ? null : (known ?? corridor.data ?? null);
  const loading = corridorId !== null && value === null && corridor.isPending;
  const unknown = corridorId !== null && known === null && corridor.isError;
  return (
    <div className="contents">
      <CorridorField
        id={`${uid}-corridor`}
        toolbar
        loadingLabel={loading ? t("loadingName") : undefined}
        legend={t("corridorFilter")}
        value={value}
        onChange={(next) => {
          setPicked(next);
          if ((next?.id ?? null) !== corridorId) {
            // Cleared while a new pair is looked up: no history entry of its own.
            setFilter("corridor_id", next?.id ?? null, {
              replace: next === null,
            });
          }
        }}
        placeholder={t(loading ? "loadingName" : "anyArea")}
        aria-describedby={unknown ? `${uid}-corridor-unknown` : undefined}
      />
      {unknown && (
        <p
          id={`${uid}-corridor-unknown`}
          className="basis-full text-table text-muted"
        >
          {t(
            isNotFound(corridor.error)
              ? "unknownCorridor"
              : "corridorUnavailable",
          )}
        </p>
      )}
    </div>
  );
}

/** The company filter (inactive companies too: their routes still exist), kept in the URL. */
function CompanyFilter({ companyId }: { companyId: string | null }) {
  const t = useTranslations("Routes");
  const uid = useId();
  const { setFilter } = useListParams();
  const [picked, setPicked] = useState<CompanyRef | null>(null);
  const known = picked !== null && picked.id === companyId ? picked : null;
  const company = useCompany(known === null ? companyId : null);

  let value: CompanyRef | null = known;
  if (companyId !== null && known === null && company.data) {
    value = { id: company.data.id, name: company.data.name };
  } else if (companyId !== null && known === null && company.isError) {
    value = {
      id: companyId,
      name: t(
        isNotFound(company.error) ? "unknownCompany" : "companyUnavailable",
      ),
    };
  }
  const loading = companyId !== null && value === null;

  return (
    <div className="flex">
      <Label htmlFor={`${uid}-company`} className="sr-only">
        {t("companyFilter")}
      </Label>
      <CompanyPicker
        id={`${uid}-company`}
        toolbarLabel={
          loading
            ? `${t("companyFilter")}: ${t("loadingName")}`
            : t("companyFilter")
        }
        includeInactive
        value={value}
        placeholder={t(loading ? "loadingName" : "anyCompany")}
        onChange={(next) => {
          setPicked(next);
          setFilter("company_id", next?.id ?? null);
        }}
      />
    </div>
  );
}
