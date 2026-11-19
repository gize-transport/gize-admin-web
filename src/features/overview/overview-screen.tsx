"use client";

import {
  ArrowRightIcon,
  BellIcon,
  IdCardIcon,
  InboxIcon,
  RocketIcon,
  RouteIcon,
  UserXIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
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
      // Shaped like the cards that come: Needs action, then Routes and Riders.
      <div className="grid gap-6">
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
        <Skeleton aria-hidden className="h-44 w-full rounded-xl" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton aria-hidden className="h-72 w-full rounded-xl" />
          <Skeleton aria-hidden className="h-72 w-full rounded-xl" />
        </div>
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

const ROUTE_STATUSES = ["active", "forming", "paused", "draft"] as const;

/** Each status's colour, in the bar and on its tile's dot (StatusPill families, told apart). */
const statusFill: Record<(typeof ROUTE_STATUSES)[number], string> = {
  active: "fill-success",
  forming: "fill-sun",
  paused: "fill-muted",
  draft: "fill-blue",
};
const statusDot: Record<(typeof ROUTE_STATUSES)[number], string> = {
  active: "bg-success",
  forming: "bg-sun",
  paused: "bg-muted",
  draft: "bg-blue",
};

function Counts({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const tStatus = useTranslations("RouteStatus");
  // Open route requests are under Needs action, whenever there are any.
  const { routes, riders, seat_offers, drivers } = overview;
  const totalRoutes = ROUTE_STATUSES.reduce(
    (sum, status) => sum + routes[status],
    0,
  );

  return (
    <>
      <NeedsAction overview={overview} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          icon={RouteIcon}
          title={t("routesTitle")}
          listLabel={t("routesLabel")}
          action={
            <Link href="/routes" className={linkClass}>
              {t("seeAllRoutes")}
            </Link>
          }
          chart={
            <Bar
              label={
                totalRoutes === 0
                  ? t("noRoutes")
                  : t("routesBar", { total: totalRoutes, ...routes })
              }
              total={totalRoutes}
              parts={ROUTE_STATUSES.map((status) => ({
                key: status,
                value: routes[status],
                fill: statusFill[status],
              }))}
            />
          }
        >
          {ROUTE_STATUSES.map((status) => (
            <Tile
              key={status}
              label={tStatus(
                status === "forming" ? "formingNoMinimum" : status,
              )}
              dot={statusDot[status]}
              count={routes[status]}
              href={`/routes?status=${status}`}
            />
          ))}
        </Section>

        <Section
          icon={UsersIcon}
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
            share={{ of: riders.total, fill: "fill-success" }}
          />
          <Tile
            label={t("starting")}
            count={riders.starting}
            hint={t("startingHint")}
            share={{ of: riders.total, fill: "fill-blue" }}
          />
          <Tile
            label={t("reserved")}
            count={riders.reserved}
            hint={t("reservedHint")}
            href="/riders?seat=reserved"
            share={{ of: riders.total, fill: "fill-sun" }}
          />
          <Tile
            label={t("allRiders")}
            count={riders.total}
            hint={t("allRidersHint")}
            href="/riders"
          />
        </Section>
      </div>

      <Section
        icon={IdCardIcon}
        title={t("moreTitle")}
        listLabel={t("moreLabel")}
        columns="two"
      >
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

type ActionItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  links: { href: string; label: string }[];
};

/**
 * Rows in one card, each with a sun icon (design-system.md "needs action"), only while their
 * count is above 0.
 */
function NeedsAction({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const headingId = useId();
  const { routes, route_requests } = overview;

  const items: ActionItem[] = [];
  if (routes.ready_to_launch > 0) {
    items.push({
      key: "ready",
      icon: RocketIcon,
      title: t("readyToLaunch", { count: routes.ready_to_launch }),
      hint: t("readyToLaunchHint"),
      links: [{ href: "/routes?status=forming", label: t("seeForming") }],
    });
  }
  if (routes.active_without_driver > 0) {
    items.push({
      key: "driver",
      icon: UserXIcon,
      title: t("withoutDriver", { count: routes.active_without_driver }),
      hint: t("withoutDriverHint"),
      links: [{ href: "/routes?status=active", label: t("seeActive") }],
    });
  }
  if (route_requests.open > 0) {
    items.push({
      key: "requests",
      icon: InboxIcon,
      title: t("openRequests", { count: route_requests.open }),
      hint: t("openRequestsHint"),
      links: [
        { href: "/route-requests?open=true", label: t("seeOpenRequests") },
        { href: "/demand", label: t("seeDemand") },
      ],
    });
  }

  return (
    <section aria-labelledby={headingId} className={cardClass}>
      <CardHeading id={headingId} icon={BellIcon} tone="sun">
        {t("actionTitle")}
      </CardHeading>
      {items.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-body text-muted">
          {t("nothingNeeded")}
        </p>
      ) : (
        <ul
          aria-label={t("actionLabel")}
          className="divide-y divide-line border-t border-line"
        >
          {items.map(({ key, icon: Icon, title, hint, links }) => (
            <li
              key={key}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-sun text-navy"
              >
                <Icon className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 className="font-display text-body font-semibold text-navy">
                  {title}
                </h3>
                <p className="text-table text-muted">{hint}</p>
              </div>
              {/* Under the text on phones, on the right from md. */}
              <div className="col-start-2 flex flex-wrap gap-x-4 gap-y-1 md:col-start-3 md:self-center">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(linkClass, "inline-flex items-center gap-1")}
                  >
                    {link.label}
                    <ArrowRightIcon aria-hidden className="size-4" />
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
const cardClass =
  "grid min-w-0 content-start overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-line";

/** A card's heading: an icon tile, the h2, and an optional link on the right. */
function CardHeading({
  id,
  icon: Icon,
  tone = "ice",
  action,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone?: "ice" | "sun";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          tone === "sun" ? "bg-sun text-navy" : "bg-ice text-royal",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <h2
        id={id}
        className="flex-1 font-display text-section font-semibold text-navy"
      >
        {children}
      </h2>
      {action && <div className="text-table">{action}</div>}
    </div>
  );
}

/** A card of counts: heading, an optional chart, the counts (a labelled list) and a footer. */
function Section({
  icon,
  title,
  listLabel,
  action,
  chart,
  footer,
  columns = "four",
  children,
}: {
  icon: LucideIcon;
  title: string;
  listLabel: string;
  action?: ReactNode;
  chart?: ReactNode;
  footer?: ReactNode;
  /** "four": 2 × 2 beside another card, a row of four when the card is full width. */
  columns?: "four" | "two";
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cardClass}>
      <CardHeading id={headingId} icon={icon} action={action}>
        {title}
      </CardHeading>
      {chart && <div className="px-5 pb-4">{chart}</div>}
      {/* 1 px gaps over the line colour draw the dividers between counts. */}
      <ul
        aria-label={listLabel}
        className={cn(
          "grid grid-cols-2 gap-px border-t border-line bg-line",
          columns === "four" && "md:grid-cols-4 xl:grid-cols-2",
        )}
      >
        {children}
      </ul>
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </section>
  );
}

type BarPart = { key: string; value: number; fill: string };

/** The narrowest a part is drawn, in % of the bar. */
const MIN_PART = 1;

/**
 * A bar split into parts: SVG with widths as attributes, not style attributes (so the CSP's
 * `style-src` can be tightened later). Described
 * in words by `label`, or hidden from screen readers when the numbers are written beside it.
 */
function Bar({
  label,
  total,
  parts,
  className,
}: {
  /** Omit for a bar for sight only. */
  label?: string;
  total: number;
  parts: BarPart[];
  className?: string;
}) {
  // Each part at least MIN_PART wide, so a tiny share still shows its colour; then scaled back
  // into the bar if that made the parts overflow it.
  const shown = total > 0 ? parts.filter((part) => part.value > 0) : [];
  const widths = shown.map((part) =>
    Math.max((part.value / total) * 100, MIN_PART),
  );
  const scale = Math.min(1, 100 / widths.reduce((sum, w) => sum + w, 0));
  // Each part starts where the ones before it end.
  const drawn: (BarPart & { x: number; width: number })[] = [];
  for (const [index, part] of shown.entries()) {
    const previous = drawn.at(-1);
    drawn.push({
      ...part,
      x: previous ? previous.x + previous.width : 0,
      width: widths[index]! * scale,
    });
  }
  return (
    <svg
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
      className={cn("h-2.5 w-full overflow-hidden rounded-full", className)}
    >
      <rect width="100" height="4" className="fill-neutral-soft" />
      {drawn.map((part) => (
        <rect
          key={part.key}
          data-part={part.key}
          x={part.x}
          width={part.width}
          height="4"
          className={part.fill}
        />
      ))}
      {/* A 2 px white gap between neighbours only, whatever the bar's width. */}
      {drawn.slice(1).map((part) => (
        <line
          key={part.key}
          x1={part.x}
          x2={part.x}
          y1="0"
          y2="4"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="stroke-white"
        />
      ))}
    </svg>
  );
}

/** A count with its label; a link to the list that holds the records, where there is one. */
function Tile({
  label,
  count,
  hint,
  href,
  dot,
  share,
}: {
  label: string;
  count: number;
  hint?: string;
  href?: string;
  /** The colour that marks it in a chart beside it. */
  dot?: string;
  /** Its share of a total, as a small bar (for sight only: the total is a count too). */
  share?: { of: number; fill: string };
}) {
  const format = useFormatter();
  // Spaces between the parts: a grid hides them, but the link's name needs them ("Active 12").
  const body = (
    <>
      <span className="flex items-center gap-2 text-table text-muted">
        {dot && (
          <span aria-hidden className={cn("size-2.5 rounded-full", dot)} />
        )}
        {label}
      </span>{" "}
      <span className="font-display text-title leading-tight font-semibold text-navy">
        {format.number(count)}
      </span>
      {share && share.of > 0 && (
        <Bar
          total={share.of}
          parts={[
            {
              key: "share",
              value: Math.min(count, share.of),
              fill: share.fill,
            },
          ]}
          className="h-1.5 max-w-40"
        />
      )}
      {hint && (
        <>
          {" "}
          <span className="text-meta text-muted">{hint}</span>
        </>
      )}
    </>
  );
  return (
    <li className="grid bg-surface">
      {href ? (
        <Link
          href={href}
          // The ring inside the link: the card clips anything outside it.
          className="grid content-start gap-1.5 p-5 transition-colors outline-offset-[-3px] hover:bg-ice"
        >
          {body}
        </Link>
      ) : (
        <div className="grid content-start gap-1.5 p-5">{body}</div>
      )}
    </li>
  );
}
