"use client";

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
import { LaunchProgress } from "@/components/launch-progress";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { useRoute } from "./queries";
import { RouteCorridor } from "./route-corridor";
import { RouteFormDialog } from "./route-form-dialog";
import { RouteStatusPill } from "./route-status-pill";

type RouteRead = components["schemas"]["RouteRead"];

type RouteDetailProps = {
  routeId: string;
  /** Its own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  onClose?: () => void;
};

/**
 * A route's details (design-system.md, "Detail panel / page"; routes mockup): corridor, type,
 * times, seats and launch progress, areas served, prices and status. Prices, areas served and
 * status moves are edited by their own tickets (GZW-022, GZW-023, GZW-024); here they're shown.
 */
export function RouteDetail({ routeId, variant, onClose }: RouteDetailProps) {
  const t = useTranslations("Routes");
  const route = useRoute(routeId);
  return (
    <DetailFrame
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
      {(data, layout) => <Loaded route={data} layout={layout} />}
    </DetailFrame>
  );
}

function Loaded({
  route,
  layout: { variant, headingId, SectionHeading, backLink },
}: {
  route: RouteRead;
  layout: DetailLayout;
}) {
  const t = useTranslations("Routes");
  const { date } = useTimestampFormat();
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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
      </section>

      <section className="grid gap-3">
        <SectionHeading className={sectionHeading}>
          {t("prices")}
        </SectionHeading>
        <Prices route={route} />
      </section>

      <section className="border-t border-line pt-5">
        <Button
          variant="secondary"
          onClick={() => {
            setFormKey((key) => (key ?? 0) + 1);
            setFormOpen(true);
          }}
        >
          {t("edit")}
        </Button>
      </section>

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
