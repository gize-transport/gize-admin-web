"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useOverview } from "./queries";

type Overview = components["schemas"]["Overview"];

/**
 * Overview (GZW-070): the home page's counts from `overview_get` only – what needs action, then
 * routes, riders, seat offers and drivers – each opening the list that holds them. Where a list
 * can't filter to exactly the counted records (ready to launch, no driver), the link says which
 * list it opens. Only widgets backed by the API (the mockup's map, backups, payments and
 * complaints aren't in the MVP).
 */
export function OverviewScreen() {
  const t = useTranslations("Overview");
  const format = useFormatter();
  const { message } = useApiErrorMessages();
  const overview = useOverview();

  if (isForbidden(overview.error)) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoPermission />
      </>
    );
  }

  let content: ReactNode;
  if (overview.isPending) {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            aria-hidden
            className="h-28 w-full rounded-xl"
          />
        ))}
      </div>
    );
  } else if (overview.isError) {
    const error = overview.error instanceof ApiError ? overview.error : null;
    content = (
      <ProblemAlert
        message={message(overview.error)}
        requestId={error?.requestId ?? null}
        retryAfterSeconds={error?.retryAfterSeconds ?? null}
        onRetry={() => void overview.refetch()}
      />
    );
  } else {
    content = <Counts overview={overview.data} />;
  }

  // The API's day (Addis Ababa), shown as it is: a calendar day, no time zone shift.
  const day = overview.data
    ? format.dateTime(new Date(`${overview.data.as_of}T00:00:00Z`), {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : null;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={day === null ? undefined : t("asOf", { date: day })}
      />
      {content}
    </>
  );
}

function Counts({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const tStatus = useTranslations("RouteStatus");
  // Open route requests are under Needs action, whenever there are any.
  const { routes, riders, seat_offers, drivers } = overview;

  return (
    <>
      <NeedsAction overview={overview} />

      <Section title={t("routesTitle")} listLabel={t("routesLabel")}>
        <Tile
          label={tStatus("active")}
          count={routes.active}
          href="/routes?status=active"
        />
        <Tile
          label={tStatus("formingNoMinimum")}
          count={routes.forming}
          href="/routes?status=forming"
        />
        <Tile
          label={tStatus("paused")}
          count={routes.paused}
          href="/routes?status=paused"
        />
        <Tile
          label={tStatus("draft")}
          count={routes.draft}
          href="/routes?status=draft"
        />
      </Section>

      <Section
        title={t("ridersTitle")}
        listLabel={t("ridersLabel")}
        footer={
          // The riders list's "with a seat" filter holds both: a seat held today or later.
          <p className="text-table text-muted">
            {t("seeWithSeatHint")}{" "}
            <Link href="/riders?seat=active" className={linkClass}>
              {t("seeWithSeat")}
            </Link>
          </p>
        }
      >
        <Tile
          label={t("riding")}
          count={riders.riding}
          hint={t("ridingHint")}
        />
        <Tile
          label={t("starting")}
          count={riders.starting}
          hint={t("startingHint")}
        />
        <Tile
          label={t("reserved")}
          count={riders.reserved}
          hint={t("reservedHint")}
          href="/riders?seat=reserved"
        />
        <Tile
          label={t("allRiders")}
          count={riders.total}
          hint={t("allRidersHint")}
          href="/riders"
        />
      </Section>

      <Section title={t("moreTitle")} listLabel={t("moreLabel")}>
        {/* Offers are listed per route only: no list to open. */}
        <Tile
          label={t("openOffers")}
          count={seat_offers.open}
          hint={t("openOffersHint")}
        />
        <Tile
          label={t("activeDrivers")}
          count={drivers.active}
          hint={t("activeDriversHint")}
          href="/drivers?is_active=true"
        />
      </Section>
    </>
  );
}

/** Highlighted (sun, design-system.md "needs action") only while their count is above 0. */
function NeedsAction({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const headingId = useId();
  const { routes, route_requests } = overview;

  const items: {
    key: string;
    title: string;
    hint: string;
    links: { href: string; label: string }[];
  }[] = [];
  if (routes.ready_to_launch > 0) {
    items.push({
      key: "ready",
      title: t("readyToLaunch", { count: routes.ready_to_launch }),
      hint: t("readyToLaunchHint"),
      links: [{ href: "/routes?status=forming", label: t("seeForming") }],
    });
  }
  if (routes.active_without_driver > 0) {
    items.push({
      key: "driver",
      title: t("withoutDriver", { count: routes.active_without_driver }),
      hint: t("withoutDriverHint"),
      links: [{ href: "/routes?status=active", label: t("seeActive") }],
    });
  }
  if (route_requests.open > 0) {
    items.push({
      key: "requests",
      title: t("openRequests", { count: route_requests.open }),
      hint: t("openRequestsHint"),
      links: [
        { href: "/route-requests?open=true", label: t("seeOpenRequests") },
        { href: "/demand", label: t("seeDemand") },
      ],
    });
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2
        id={headingId}
        className="font-display text-section font-semibold text-navy"
      >
        {t("actionTitle")}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface p-5 text-body text-muted ring-1 ring-line">
          {t("nothingNeeded")}
        </p>
      ) : (
        <ul
          aria-label={t("actionLabel")}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {items.map((item) => (
            <li
              key={item.key}
              className="grid content-start gap-2 rounded-xl bg-sun p-5 text-navy"
            >
              <h3 className="font-display text-body font-semibold">
                {item.title}
              </h3>
              <p className="text-table">{item.hint}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {item.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="w-fit text-table font-semibold underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const linkClass = "font-semibold text-royal underline-offset-4 hover:underline";

function Section({
  title,
  listLabel,
  footer,
  children,
}: {
  title: string;
  listLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2
        id={headingId}
        className="font-display text-section font-semibold text-navy"
      >
        {title}
      </h2>
      <ul
        aria-label={listLabel}
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        {children}
      </ul>
      {footer}
    </section>
  );
}

/** A count with its label; a link to the list that holds the records, where there is one. */
function Tile({
  label,
  count,
  hint,
  href,
}: {
  label: string;
  count: number;
  hint?: string;
  href?: string;
}) {
  const format = useFormatter();
  // Spaces between the parts: a grid hides them, but the link's name needs them ("Active 12").
  const body = (
    <>
      <span className="text-table text-muted">{label}</span>{" "}
      <span className="font-display text-title leading-tight font-semibold text-navy">
        {format.number(count)}
      </span>
      {hint && (
        <>
          {" "}
          <span className="text-meta text-muted">{hint}</span>
        </>
      )}
    </>
  );
  return (
    <li className="grid rounded-xl bg-surface shadow-sm ring-1 ring-line">
      {href ? (
        <Link
          href={href}
          className="grid content-start gap-1 rounded-xl p-5 transition-colors hover:bg-ice"
        >
          {body}
        </Link>
      ) : (
        <div className="grid content-start gap-1 p-5">{body}</div>
      )}
    </li>
  );
}
