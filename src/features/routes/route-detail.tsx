"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  DetailFrame,
  DetailHeading,
  Fact,
  Facts,
  isNotFound,
  type DetailLayout,
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
import { refetchRoute, useDeleteRoute, useRoute } from "./queries";
import { RouteCorridor } from "./route-corridor";
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
  layout: { variant, headingId, SectionHeading, backLink },
  onDeleted,
  onOpenRoute,
}: {
  route: RouteRead;
  layout: DetailLayout;
  onDeleted?: () => void;
  onOpenRoute?: (id: string) => void;
}) {
  const t = useTranslations("Routes");
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

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <DetailHeading id={headingId} variant={variant}>
            <span className="font-mono">{route.code}</span>
          </DetailHeading>
          <RouteStatusPill route={route} />
        </div>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("corridor")}>
          <RouteCorridor corridor={route.corridor} />
        </Fact>
        <Fact label={t("type")}>{typeLabel(route, t)}</Fact>
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
        <Fact label={t("seats")}>
          <span className="grid gap-0.5">
            <span>{t("seatsTotal", { seats: route.seats })}</span>
            <span className="text-table text-muted">
              {t("seatsThisMonth", {
                taken: route.seats_taken.this_month,
                free: route.seats_free.this_month,
              })}
            </span>
            <span className="text-table text-muted">
              {t("seatsNextMonth", {
                taken: route.seats_taken.next_month,
                free: route.seats_free.next_month,
              })}
            </span>
          </span>
        </Fact>
        {route.launch_minimum !== null && (
          <Fact label={t("launchMinimum")}>
            <span className="grid gap-2">
              <span>
                {t("launchMinimumValue", { minimum: route.launch_minimum })}
              </span>
              {route.status === "forming" && (
                <LaunchProgress
                  reserved={route.reserved}
                  minimum={route.launch_minimum}
                />
              )}
            </span>
          </Fact>
        )}
        {route.copied_from_route_id !== null && (
          <Fact label={t("copiedFrom")}>
            <CopiedFrom id={route.copied_from_route_id} />
          </Fact>
        )}
        <Fact label={t("added")}>{date(route.created_at)}</Fact>
      </Facts>

      <section className="grid gap-3">
        <SectionHeading className={sectionHeading}>
          {t("areasServed")}
        </SectionHeading>
        {route.served_areas.length === 0 ? (
          <p className="text-body text-muted">
            {t("areasServedNone", { origin, destination })}
          </p>
        ) : (
          <AreasPath route={route} />
        )}
        <EditAreas route={route} />
      </section>

      <section className="grid gap-3">
        <SectionHeading className={sectionHeading}>
          {t("prices")}
        </SectionHeading>
        <Prices route={route} />
      </section>

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

      {/* Offers are for adults' (public) routes. */}
      {route.route_type === "public" && (
        <SeatOffers
          route={route}
          SectionHeading={SectionHeading}
          headingClass={sectionHeading}
        />
      )}

      <section className="grid gap-4 border-t border-line pt-5">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setFormKey((key) => (key ?? 0) + 1);
              setFormOpen(true);
            }}
          >
            {t("edit")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setVanKey((key) => (key ?? 0) + 1);
              setVanOpen(true);
            }}
          >
            {t("addVan")}
          </Button>
        </div>
        {isAdmin && (
          <div className="grid gap-2 border-t border-line pt-4">
            <SectionHeading className="text-table font-semibold text-danger">
              {t("deleteSection")}
            </SectionHeading>
            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => setDeleting(true)}
            >
              {t("deleteRoute")}
            </Button>
          </div>
        )}
      </section>

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

/** Staff edit the areas served (GZW-023) in a dialog. */
function EditAreas({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  const [dialogKey, setDialogKey] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className="w-fit"
        onClick={() => {
          setDialogKey((key) => (key ?? 0) + 1);
          setDialogOpen(true);
        }}
      >
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

/** The prices, or the agreed rate on a corporate route; admins set them (GZW-022). */
function Prices({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  // Admins only (the API refuses others): staff see the prices.
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const [dialogKey, setDialogKey] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  if (route.prices === null) {
    return <p className="text-body text-ink">{t("rateAgreed")}</p>;
  }
  const price = (amount: number | null): ReactNode =>
    amount === null ? (
      <span className="text-muted">{t("notSet")}</span>
    ) : (
      t("priceValue", { amount })
    );
  const anySet = Object.values(route.prices).some((amount) => amount !== null);
  return (
    <div className="grid gap-3">
      <div role="group" aria-label={t("prices")}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <Fact label={t("priceRoundTrip")}>
            {price(route.prices.round_trip)}
          </Fact>
          <Fact label={t("priceOneWay")}>{price(route.prices.one_way)}</Fact>
          {route.route_type === "public" && (
            <Fact label={t("priceSaturday")}>
              {price(route.prices.saturday)}
            </Fact>
          )}
        </dl>
      </div>
      {isAdmin && (
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => {
            setDialogKey((key) => (key ?? 0) + 1);
            setDialogOpen(true);
          }}
        >
          {t(anySet ? "changePrices" : "setPrices")}
        </Button>
      )}
      {dialogKey !== null && (
        <RoutePricesDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          route={route}
        />
      )}
    </div>
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
