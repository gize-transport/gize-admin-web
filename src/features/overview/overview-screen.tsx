"use client";

import {
  ArrowRightIcon,
  BellIcon,
  ChevronRightIcon,
  InboxIcon,
  RocketIcon,
  RouteIcon,
  UserXIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useId, type ReactNode } from "react";
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

/** The stages a route moves through, in order; paused sits apart. */
const STAGES = ["draft", "forming", "active"] as const;

/** Each status's colour, in the bar and on its stage's dot (StatusPill families, told apart). */
const statusFill: Record<(typeof STAGES)[number] | "paused", string> = {
  draft: "fill-blue",
  forming: "fill-sun",
  active: "fill-success",
  paused: "fill-muted",
};
const statusDot: Record<(typeof STAGES)[number] | "paused", string> = {
  draft: "bg-blue",
  forming: "bg-sun",
  active: "bg-success",
  paused: "bg-muted",
};

function Counts({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  // Open route requests are under Needs action, whenever there are any.
  const { seat_offers, drivers } = overview;

  return (
    <>
      <NeedsAction overview={overview} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RouteStages overview={overview} />
        <RiderBars overview={overview} />
      </div>

      {/* A slim row of the other counts, under the two cards. */}
      <div className={cardClass}>
        <ul
          aria-label={t("moreLabel")}
          className="grid gap-px bg-line md:grid-cols-2"
        >
          {/* Offers are listed per route only: no list to open. */}
          <Stat
            label={t("openOffers")}
            count={seat_offers.open}
            hint={t("openOffersHint")}
          />
          <Stat
            label={t("activeDrivers")}
            count={drivers.active}
            hint={t("activeDriversHint")}
            href="/drivers?is_active=true"
          />
        </ul>
      </div>
    </>
  );
}

/**
 * Routes as the stages a route moves through (GZW-080): draft → forming → active, each opening
 * its routes, with what needs doing at that stage as a tag (only above 0: ready to launch,
 * without a driver); paused apart, small.
 */
function RouteStages({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const tStatus = useTranslations("RouteStatus");
  const format = useFormatter();
  const headingId = useId();
  const { routes } = overview;
  const total =
    STAGES.reduce((sum, stage) => sum + routes[stage], 0) + routes.paused;
  const tags: Partial<Record<(typeof STAGES)[number], ReactNode>> = {};
  if (routes.ready_to_launch > 0) {
    tags.forming = (
      <Tag icon={RocketIcon}>
        {t("tagReady", { count: routes.ready_to_launch })}
      </Tag>
    );
  }
  if (routes.active_without_driver > 0) {
    tags.active = (
      <Tag icon={UserXIcon}>
        {t("tagNoDriver", { count: routes.active_without_driver })}
      </Tag>
    );
  }
  const hints = {
    draft: t("stageDraftHint"),
    forming: t("stageFormingHint"),
    active: t("stageActiveHint"),
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(cardClass, "grid-rows-[auto_1fr] content-stretch")}
    >
      <CardHeading
        id={headingId}
        icon={RouteIcon}
        count={t("inAll", { total })}
        action={
          <Link href="/routes" className={linkClass}>
            {t("seeAllRoutes")}
          </Link>
        }
      >
        {t("routesTitle")}
      </CardHeading>
      {/* The bar and Paused at the card's foot (beside the riders card, which can be taller). */}
      <div className="grid min-w-0 content-between gap-5 px-5 pb-5">
        <ol
          aria-label={t("routesLabel")}
          // Stacked on phones (arrows pointing down), side by side from sm.
          className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          {STAGES.map((stage, index) => (
            <Fragment key={stage}>
              {index > 0 && (
                <li aria-hidden className="grid place-items-center text-muted">
                  <ChevronRightIcon className="size-4 max-sm:rotate-90" />
                </li>
              )}
              <li className="grid min-w-0">
                <Link
                  href={`/routes?status=${stage}`}
                  className={cn(
                    "grid content-start gap-1 rounded-lg border p-3 transition-colors hover:border-royal hover:bg-ice",
                    // One line on phones: label, count, then the tag or hint.
                    "max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3",
                    tags[stage] ? "border-sun" : "border-line",
                  )}
                >
                  <span className="flex items-center gap-2 text-table text-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        statusDot[stage],
                      )}
                    />
                    {tStatus(stage === "forming" ? "formingNoMinimum" : stage)}
                  </span>{" "}
                  <span className="font-display text-title leading-tight font-semibold text-navy">
                    {format.number(routes[stage])}
                  </span>{" "}
                  {/* "Forming 6 routes, 2 ready to launch": the two numbers apart. */}
                  <span className="sr-only">
                    {t("stageCountSpoken", { count: routes[stage] })}
                  </span>{" "}
                  {tags[stage] ?? (
                    <span className="text-meta text-muted">{hints[stage]}</span>
                  )}
                </Link>
              </li>
            </Fragment>
          ))}
        </ol>
        <div className="grid gap-3">
          <Bar
            label={
              total === 0 ? t("noRoutes") : t("routesBar", { total, ...routes })
            }
            total={total}
            parts={[...STAGES, "paused" as const].map((status) => ({
              key: status,
              value: routes[status],
              fill: statusFill[status],
            }))}
          />
          <Link
            href="/routes?status=paused"
            className="flex w-fit items-center gap-2 text-table text-muted underline-offset-4 hover:text-navy hover:underline"
          >
            <span
              aria-hidden
              className={cn("size-2.5 rounded-full", statusDot.paused)}
            />
            {tStatus("paused")}{" "}
            <span className="font-semibold text-ink tabular-nums">
              {format.number(routes.paused)}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** What needs doing at a stage, in the "needs action" sun. */
function Tag({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex w-fit items-start gap-1 rounded-md bg-sun px-2 py-1 text-meta leading-snug font-semibold text-navy sm:mt-1">
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      {children}
    </span>
  );
}

const RIDER_ROWS = [
  { key: "riding", fill: "fill-success", hint: "ridingHint" },
  { key: "starting", fill: "fill-blue", hint: "startingHint" },
  {
    key: "reserved",
    fill: "fill-sun",
    hint: "reservedHint",
    href: "/riders?seat=reserved",
  },
] as const;

/**
 * Riders by seat as rows of bars (GZW-080), each bar out of all riders so they compare at a
 * glance; the count is written beside each (the bars are for sight only).
 */
function RiderBars({ overview }: { overview: Overview }) {
  const t = useTranslations("Overview");
  const format = useFormatter();
  const headingId = useId();
  const { riders } = overview;
  // No bars out of nothing: with no riders, just the counts (all 0).
  const bars = riders.total > 0;

  return (
    <section
      aria-labelledby={headingId}
      // The foot stays at the bottom when the routes card beside it is taller.
      className={cn(cardClass, "grid-rows-[auto_1fr_auto] content-stretch")}
    >
      <CardHeading
        id={headingId}
        icon={UsersIcon}
        count={t("inAll", { total: riders.total })}
        action={
          <Link href="/riders" className={linkClass}>
            {t("allRiders")}
          </Link>
        }
      >
        {t("ridersTitle")}
      </CardHeading>
      <ul
        aria-label={t("ridersLabel")}
        className="grid content-start px-5 pb-3"
      >
        {RIDER_ROWS.map((row) => {
          const count = riders[row.key];
          const body = (
            <>
              <span className="col-start-1 row-start-1 grid">
                <span className="text-table font-semibold text-ink">
                  {t(row.key)}
                </span>{" "}
                <span className="text-meta text-muted">{t(row.hint)}</span>
              </span>{" "}
              {/* Under the label on phones (the full width), between label and count from sm. */}
              {bars && (
                <Bar
                  total={riders.total}
                  parts={[
                    {
                      key: row.key,
                      value: Math.min(count, riders.total),
                      fill: row.fill,
                    },
                  ]}
                  className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                />
              )}{" "}
              <span className="col-start-2 row-start-1 text-right font-display text-section font-semibold text-navy tabular-nums sm:col-start-3">
                {format.number(count)}
              </span>
            </>
          );
          const rowClass =
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-lg px-2 py-2.5 sm:grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)_auto]";
          return (
            <li key={row.key} className="-mx-2 grid">
              {"href" in row ? (
                <Link
                  href={row.href}
                  className={cn(rowClass, "transition-colors hover:bg-ice")}
                >
                  {body}
                </Link>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {/* The riders list's "with a seat" filter holds both: a seat held today or later. */}
      <p className="border-t border-line px-5 py-3 text-table text-muted">
        {bars && <>{t("ridersBarsHint", { total: riders.total })} </>}
        {t("seeWithSeatHint")}{" "}
        <Link href="/riders?seat=active" className={linkClass}>
          {t("seeWithSeat")}
        </Link>
      </p>
    </section>
  );
}

/** One count in the slim row under the cards; a link to its list where there is one. */
function Stat({
  label,
  count,
  hint,
  href,
}: {
  label: string;
  count: number;
  hint: string;
  href?: string;
}) {
  const format = useFormatter();
  const body = (
    <>
      <span className="grid">
        <span className="text-table font-semibold text-ink">{label}</span>{" "}
        <span className="text-meta text-muted">{hint}</span>
      </span>{" "}
      <span className="font-display text-title leading-tight font-semibold text-navy tabular-nums">
        {format.number(count)}
      </span>
    </>
  );
  const className =
    "flex items-center justify-between gap-4 px-5 py-4 outline-offset-[-3px]";
  return (
    <li className="grid bg-surface">
      {href ? (
        <Link
          href={href}
          className={cn(className, "transition-colors hover:bg-ice")}
        >
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
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
  count,
  action,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone?: "ice" | "sun";
  /** Beside the heading, e.g. "12 in all". */
  count?: string;
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
      <div className="flex flex-1 flex-wrap items-baseline gap-x-2">
        <h2
          id={id}
          className="font-display text-section font-semibold text-navy"
        >
          {children}
        </h2>
        {count && <span className="text-table text-muted">{count}</span>}
      </div>
      {action && <div className="text-table">{action}</div>}
    </div>
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
