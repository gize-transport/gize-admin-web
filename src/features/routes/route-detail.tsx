"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CopyPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  ActionsMenu,
  ActionsMenuItem,
  ActionsMenuSeparator,
  CopyLinkItem,
} from "@/components/detail/actions-menu";
import { DetailCard, detailSurface } from "@/components/detail/detail-card";
import { DetailHeader } from "@/components/detail/detail-header";
import { DetailTabs, type DetailTab } from "@/components/detail/detail-tabs";
import {
  DetailFrame,
  Fact,
  Facts,
  isNotFound,
  type DetailLayout,
  type DetailVariant,
} from "@/components/detail/detail-frame";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LaunchProgress } from "@/components/launch-progress";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { LaunchMessages } from "@/features/launches/launch-messages";
import { SeatOffers } from "@/features/offers/seat-offers";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { cn } from "@/lib/utils";
import { refetchRoute, useDeleteRoute, useRoute } from "./queries";
import { RouteCorridor } from "./route-corridor";
import { RouteDriver } from "./route-driver";
import { RouteAreasDialog } from "./route-areas-dialog";
import { RouteFormDialog } from "./route-form-dialog";
import { RoutePricesDialog } from "./route-prices-dialog";
import { RouteStatusActions } from "./route-status-actions";
import { RouteStatusPill } from "./route-status-pill";
import { RouteVanDialog } from "./route-van-dialog";

type RouteRead = components["schemas"]["RouteRead"];

type RouteDetailProps = {
  routeId: string;
  /** Its own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  onClose?: () => void;
  /** After the route is deleted: the page goes back to the list, the panel closes. */
  onDeleted?: () => void;
  /** Opens another route (a van just added): its page, or the panel. */
  onOpenRoute?: (id: string) => void;
};

/**
 * A route's details (design-system.md, "Detail panel / page"; routes mockup): corridor, type,
 * times, seats and launch progress, areas served, prices and status. Prices, areas served and
 * status moves are edited by their own tickets (GZW-022, GZW-023, GZW-024); here they're shown.
 */
export function RouteDetail({
  routeId,
  variant,
  onClose,
  onDeleted,
  onOpenRoute,
}: RouteDetailProps) {
  const t = useTranslations("Routes");
  const route = useRoute(routeId);
  return (
    <DetailFrame
      recordId={routeId}
      query={route}
      variant={variant}
      listHref="/routes"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => (
        <Loaded
          route={data}
          layout={layout}
          onDeleted={onDeleted}
          onOpenRoute={onOpenRoute}
        />
      )}
    </DetailFrame>
  );
}

function Loaded({
  route,
  layout,
  onDeleted,
  onOpenRoute,
}: {
  route: RouteRead;
  layout: DetailLayout;
  onDeleted?: () => void;
  onOpenRoute?: (id: string) => void;
}) {
  const t = useTranslations("Routes");
  const { variant, SectionHeading } = layout;
  const tabs: DetailTab[] = [];
  const { date } = useTimestampFormat();
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vanKey, setVanKey] = useState<number | null>(null);
  const [vanOpen, setVanOpen] = useState(false);
  // Delete shows for admins only; the API still refuses others.
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const origin = route.corridor.origin_area.name;
  const destination = route.corridor.destination_area.name;
  const time = (value: string | null) => value ?? t("notSet");
  const sectionHeading = "font-display text-section font-semibold text-navy";
  const launchReady = route.status_changes.some(
    (change) => change.to === "active" && change.ready,
  );

  tabs.push(
    {
      value: "details",
      label: t("tabDetails"),
      content: (
        <>
          <DetailCard
            title={t("scheduleTitle")}
            SectionHeading={SectionHeading}
            variant={variant}
          >
            <Facts label={t("detailLabel")} variant={variant} compact>
              {route.school_name !== null && (
                <Fact label={t("school")}>{route.school_name}</Fact>
              )}
              {route.company !== null && (
                <Fact label={t("company")}>
                  <Link
                    href={`/companies/${route.company.id}`}
                    className="font-semibold text-royal underline-offset-4 hover:underline"
                  >
                    {route.company.name}
                  </Link>
                </Fact>
              )}
              <Fact label={t("morningRun")}>
                {t("run", {
                  from: origin,
                  leave: route.morning_time,
                  to: destination,
                  arrive: time(route.morning_arrival_time),
                })}
              </Fact>
              <Fact label={t("eveningRun")}>
                {t("run", {
                  from: destination,
                  leave: route.return_time,
                  to: origin,
                  arrive: time(route.return_arrival_time),
                })}
              </Fact>
              {/* While forming, the "To launch" tile says it ("7 of 10 needed"). */}
              {route.launch_minimum !== null && route.status !== "forming" && (
                <Fact label={t("launchMinimum")}>
                  {t("launchMinimumValue", { minimum: route.launch_minimum })}
                </Fact>
              )}
              {route.copied_from_route_id !== null && (
                <Fact label={t("copiedFrom")}>
                  <CopiedFrom id={route.copied_from_route_id} />
                </Fact>
              )}
            </Facts>
          </DetailCard>
          <div
            className={cn(
              "grid content-start gap-6",
              variant === "page" && "lg:grid-cols-2",
            )}
          >
            <DetailCard
              title={t("areasServed")}
              SectionHeading={SectionHeading}
              variant={variant}
              action={<EditAreas route={route} />}
            >
              {route.served_areas.length === 0 ? (
                <p className="text-body text-muted">
                  {t("areasServedNone", { origin, destination })}
                </p>
              ) : (
                <AreasPath route={route} />
              )}
            </DetailCard>
            <DetailCard
              title={t("prices")}
              SectionHeading={SectionHeading}
              variant={variant}
              action={<PricesButton route={route} />}
            >
              <Prices route={route} />
            </DetailCard>
          </div>
        </>
      ),
    },
    {
      value: "status",
      label: (
        <>
          {t("tabStatus")}
          {launchReady && (
            <>
              <span
                aria-hidden="true"
                className="rounded-full bg-sun px-2 py-0.5 text-meta font-semibold text-navy"
              >
                {t("tabReady")}
              </span>
              <span className="sr-only">{t("tabReadySpoken")}</span>
            </>
          )}
        </>
      ),
      content: (
        <>
          <section className="grid gap-3">
            <SectionHeading className={sectionHeading}>
              {t("status")}
            </SectionHeading>
            <RouteStatusActions route={route} />
          </section>
          <LaunchMessages
            route={route}
            SectionHeading={SectionHeading}
            headingClass={sectionHeading}
          />
        </>
      ),
    },
  );
  // Offers are for adults' (public) routes.
  if (route.route_type === "public") {
    tabs.push({
      value: "offers",
      label: t("tabOffers"),
      content: (
        <SeatOffers
          route={route}
          SectionHeading={SectionHeading}
          headingClass={sectionHeading}
        />
      ),
    });
  }

  return (
    <>
      <DetailHeader
        layout={layout}
        title={<span className="font-mono">{route.code}</span>}
        status={<RouteStatusPill route={route} />}
        summary={
          <>
            <RouteCorridor corridor={route.corridor} />
            {" · "}
            {typeLabel(route, t)}
            {" · "}
            {t("addedOn", { date: date(route.created_at) })}
          </>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setFormKey((key) => (key ?? 0) + 1);
              setFormOpen(true);
            }}
          >
            <PencilIcon aria-hidden />
            {t("edit")}
          </Button>
        }
        menu={
          <ActionsMenu name={route.code}>
            <ActionsMenuItem
              icon={<CopyPlusIcon aria-hidden />}
              onSelect={() => {
                setVanKey((key) => (key ?? 0) + 1);
                setVanOpen(true);
              }}
            >
              {t("addVan")}
            </ActionsMenuItem>
            <CopyLinkItem path={`/routes/${route.id}`} />
            {isAdmin && (
              <>
                <ActionsMenuSeparator />
                <ActionsMenuItem
                  tone="danger"
                  icon={<Trash2Icon aria-hidden />}
                  onSelect={() => setDeleting(true)}
                >
                  {t("deleteRoute")}
                </ActionsMenuItem>
              </>
            )}
          </ActionsMenu>
        }
      />

      <RouteGlance route={route} variant={variant} />

      <DetailTabs label={t("tabsLabel", { code: route.code })} tabs={tabs} />

      {vanKey !== null && (
        <RouteVanDialog
          key={vanKey}
          open={vanOpen}
          onOpenChange={setVanOpen}
          route={route}
          onAdded={(van) => onOpenRoute?.(van.id)}
        />
      )}
      <DeleteRouteDialog
        route={route}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={onDeleted}
      />

      {formKey !== null && (
        <RouteFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          route={route}
        />
      )}
    </>
  );
}

/** "Public", "Student · school" or "Corporate · company". */
export function typeLabel(
  route: Pick<RouteRead, "route_type" | "school_name" | "company">,
  t: ReturnType<typeof useTranslations<"Routes">>,
): string {
  if (route.route_type === "student" && route.school_name) {
    return t("typeWithSchool", { school: route.school_name });
  }
  if (route.route_type === "corporate" && route.company) {
    return t("typeWithCompany", { company: route.company.name });
  }
  return t(
    route.route_type === "public"
      ? "typePublic"
      : route.route_type === "student"
        ? "typeStudent"
        : "typeCorporate",
  );
}

/**
 * The route at a glance (GZW-078): seats taken this month and next, riders still needed while
 * it's forming, and its driver (chosen or changed right there).
 */
function RouteGlance({
  route,
  variant,
}: {
  route: RouteRead;
  variant: DetailVariant;
}) {
  const t = useTranslations("Routes");
  const forming = route.status === "forming" && route.launch_minimum !== null;
  return (
    <div role="group" aria-label={t("glanceLabel")}>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
        <Tile variant={variant} label={t("tileThisMonth")}>
          <SeatsValue
            taken={route.seats_taken.this_month}
            free={route.seats_free.this_month}
            seats={route.seats}
          />
        </Tile>
        <Tile variant={variant} label={t("tileNextMonth")}>
          <SeatsValue
            taken={route.seats_taken.next_month}
            free={route.seats_free.next_month}
            seats={route.seats}
          />
        </Tile>
        {forming && route.launch_minimum !== null && (
          <Tile variant={variant} label={t("tileLaunch")}>
            <LaunchProgress
              reserved={route.reserved}
              minimum={route.launch_minimum}
            />
          </Tile>
        )}
        <Tile
          variant={variant}
          label={t("driver")}
          // The third of three, where tiles sit two to a row (the panel, phones): the whole row,
          // so its name and buttons sit side by side instead of stacked in half the width.
          className={
            forming
              ? undefined
              : variant === "panel"
                ? "col-span-full"
                : "max-sm:col-span-full"
          }
        >
          <RouteDriver route={route} />
        </Tile>
      </dl>
    </div>
  );
}

function Tile({
  variant,
  label,
  className,
  children,
}: {
  variant: DetailVariant;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-1 rounded-lg px-3 py-2.5",
        detailSurface(variant),
        className,
      )}
    >
      <dt className="text-meta font-semibold text-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}

function SeatsValue({
  taken,
  free,
  seats,
}: {
  taken: number;
  free: number;
  seats: number;
}) {
  const t = useTranslations("Routes");
  return (
    <>
      <span className="block font-semibold tabular-nums">
        {t("tileSeats", { taken, seats })}
      </span>
      <span className="block text-table text-muted tabular-nums">
        {t("tileFree", { free })}
      </span>
    </>
  );
}

/** Staff edit the areas served (GZW-023) in a dialog. */
function EditAreas({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  const [dialogKey, setDialogKey] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setDialogKey((key) => (key ?? 0) + 1);
          setDialogOpen(true);
        }}
      >
        <PencilIcon aria-hidden />
        {t("editAreas")}
      </Button>
      {dialogKey !== null && (
        <RouteAreasDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          route={route}
        />
      )}
    </>
  );
}

/** "A → CMC → Megenagna → B", as an ordered list (the arrows are decoration). */
function AreasPath({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  const stops = [
    route.corridor.origin_area,
    ...route.served_areas,
    route.corridor.destination_area,
  ];
  return (
    <ol
      aria-label={t("areasServedLabel")}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body"
    >
      {stops.map((area, index) => (
        <li
          key={`${area.id}-${index}`}
          className={
            index === 0 || index === stops.length - 1
              ? "font-semibold text-navy"
              : "text-ink"
          }
        >
          {index > 0 && (
            <span aria-hidden="true" className="mr-2 text-muted">
              →
            </span>
          )}
          {area.name}
        </li>
      ))}
    </ol>
  );
}

/** The prices, or the agreed rate on a corporate route. */
function Prices({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  if (route.prices === null) {
    return <p className="text-body text-ink">{t("rateAgreed")}</p>;
  }
  const price = (amount: number | null): ReactNode =>
    amount === null ? (
      <span className="text-muted">{t("notSet")}</span>
    ) : (
      t("priceValue", { amount })
    );
  return (
    <div role="group" aria-label={t("prices")}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Fact label={t("priceRoundTrip")}>
          {price(route.prices.round_trip)}
        </Fact>
        <Fact label={t("priceOneWay")}>{price(route.prices.one_way)}</Fact>
        {route.route_type === "public" && (
          <Fact label={t("priceSaturday")}>{price(route.prices.saturday)}</Fact>
        )}
      </dl>
    </div>
  );
}

/** Admins set or change the prices (GZW-022; the API refuses others); none on a corporate route. */
function PricesButton({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const [dialogKey, setDialogKey] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  if (route.prices === null || !isAdmin) return null;
  const anySet = Object.values(route.prices).some((amount) => amount !== null);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setDialogKey((key) => (key ?? 0) + 1);
          setDialogOpen(true);
        }}
      >
        <PencilIcon aria-hidden />
        {t(anySet ? "changePrices" : "setPrices")}
      </Button>
      {dialogKey !== null && (
        <RoutePricesDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          route={route}
        />
      )}
    </>
  );
}

/** The route this one was copied from (add a van); a deleted original says so. */
function CopiedFrom({ id }: { id: string }) {
  const t = useTranslations("Routes");
  const original = useRoute(id);
  if (original.isPending) {
    return <span className="text-muted">{t("loadingName")}</span>;
  }
  if (isNotFound(original.error)) {
    return <span className="text-muted">{t("copiedFromDeleted")}</span>;
  }
  if (original.isError) {
    return <span className="text-muted">{t("copiedFromUnavailable")}</span>;
  }
  return (
    <Link
      href={`/routes/${original.data.id}`}
      className="font-mono font-semibold text-royal underline-offset-4 hover:underline"
    >
      {original.data.code}
    </Link>
  );
}

/** Admin delete, confirmed; refused while riders hold seats or a request names the route. */
function DeleteRouteDialog({
  route,
  open,
  onClose,
  onDeleted,
}: {
  route: RouteRead;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Routes");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteRoute();
  const error = remove.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Gone already (deleted meanwhile): its detail shows that once the dialog closes.
        if (error instanceof ApiError && error.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        // The next time it opens, it starts without this attempt's error.
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle", { code: route.code })}
      description={t("deleteDescription")}
      confirmLabel={t("deleteRoute")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        remove.mutate(route.id, {
          onSuccess: () => {
            showSuccessToast(t("deleted", { code: route.code }));
            onClose();
            onDeleted?.();
          },
        })
      }
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "ROUTE_HAS_RIDERS"
              ? t("deleteHasRiders")
              : error instanceof ApiError && error.code === "ROUTE_HAS_REQUESTS"
                ? t("deleteHasRequests")
                : message(error)
          }
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
