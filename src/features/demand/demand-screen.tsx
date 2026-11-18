"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode } from "react";
import { focusDetailWhenOpened } from "@/components/detail/detail-frame";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaFormDialog } from "@/features/areas/area-form-dialog";
import { CorridorFormDialog } from "@/features/corridors/corridor-form-dialog";
import { fetchCorridorBetween } from "@/features/corridors/queries";
import { useDemandSummary } from "@/features/route-requests/queries";
import { fetchRoute } from "@/features/routes/queries";
import { RouteFormDialog } from "@/features/routes/route-form-dialog";
import { RouteVanDialog } from "@/features/routes/route-van-dialog";
import { useApiErrorMessages } from "@/lib/api/errors";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type AreaPairDemand = components["schemas"]["AreaPairDemand"];
type RouteDemand = components["schemas"]["RouteDemand"];
type RouteStatus = components["schemas"]["RouteStatus"];
type RouteRead = components["schemas"]["RouteRead"];
type AreaRef = components["schemas"]["AreaRef"];
type CorridorRef = components["schemas"]["CorridorRef"];

/** What a card opens: one form at a time, mounted fresh (its own Idempotency-Key). */
type Opened =
  | { kind: "corridor"; origin: AreaRef; destination: AreaRef; key: number }
  | { kind: "route"; corridor: CorridorRef; key: number }
  | { kind: "van"; route: RouteRead; key: number }
  | { kind: "area"; name: string; pair: AreaPairDemand; key: number };
type Open = (opened: DistributiveOmit<Opened, "key">) => void;
type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never;

const statusTones: Record<RouteStatus, StatusTone> = {
  draft: "neutral",
  forming: "waiting",
  active: "success",
  paused: "neutral",
};

/**
 * Demand (GZW-041): where the next route or van should go – open route requests per area pair
 * and per route next to its free seats, busiest first (`route_requests_summary`, at most 100 of
 * each). From an area pair of listed areas staff add the corridor or route it needs; from a
 * route, a van.
 * The card layout follows the waitlists mockup (there are no waitlists).
 */
export function DemandScreen() {
  const t = useTranslations("Demand");
  const { message } = useApiErrorMessages();
  const router = useRouter();
  const summary = useDemandSummary();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [formOpen, setFormOpenState] = useState(false);
  // A form is open: a lookup that answers late (another card's "Add route") doesn't replace it.
  const formOpenNow = useRef(false);
  const setFormOpen = (next: boolean) => {
    formOpenNow.current = next;
    setFormOpenState(next);
  };
  // A pair whose name was just added as an area: its card (now under the area) takes focus.
  const focusPair = useRef<string | null>(null);
  const open: Open = (next) => {
    if (formOpenNow.current) return;
    setOpened(
      (previous) => ({ ...next, key: (previous?.key ?? 0) + 1 }) as Opened,
    );
    setFormOpen(true);
  };

  if (isForbidden(summary.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  let content: ReactNode;
  if (summary.isPending) {
    content = (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            aria-hidden
            className="h-40 w-full rounded-xl"
          />
        ))}
      </div>
    );
  } else if (summary.isError) {
    content = (
      <ProblemAlert
        message={message(summary.error)}
        requestId={
          summary.error instanceof ApiError ? summary.error.requestId : null
        }
        retryAfterSeconds={
          summary.error instanceof ApiError
            ? summary.error.retryAfterSeconds
            : null
        }
        onRetry={() => void summary.refetch()}
      />
    );
  } else {
    const { area_pairs, area_pairs_truncated, routes, routes_truncated } =
      summary.data;
    content = (
      <>
        <Section
          title={t("pairsTitle")}
          description={t("pairsDescription")}
          listLabel={t("pairsLabel")}
          empty={t("pairsEmpty")}
          truncated={area_pairs_truncated}
        >
          {area_pairs.map((pair) => (
            <PairCard
              key={pairKey(pair)}
              pairKey={pairKey(pair)}
              pair={pair}
              open={open}
            />
          ))}
        </Section>
        <Section
          title={t("routesTitle")}
          description={t("routesDescription")}
          listLabel={t("routesLabel")}
          empty={t("routesEmpty")}
          truncated={routes_truncated}
        >
          {routes.map((demand) => (
            <RouteCard key={demand.route.id} demand={demand} open={open} />
          ))}
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {content}

      {opened?.kind === "corridor" && (
        <CorridorFormDialog
          key={opened.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          initialAreas={{
            origin: opened.origin,
            destination: opened.destination,
          }}
        />
      )}
      {opened?.kind === "route" && (
        <RouteFormDialog
          key={opened.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          initialCorridor={opened.corridor}
        />
      )}
      {opened?.kind === "area" && (
        <AreaFormDialog
          key={opened.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          initialName={opened.name}
          onSaved={(area) => {
            // The card moves under the area once the summary is read again: focus it there.
            focusPair.current = pairKeyWith(opened.pair, opened.name, area);
          }}
          focusOnClose={() => {
            const key = focusPair.current;
            focusPair.current = null;
            if (key === null) return null;
            return document.querySelector<HTMLElement>(
              `[data-pair-key="${CSS.escape(key)}"] h3`,
            );
          }}
        />
      )}
      {opened?.kind === "van" && (
        <RouteVanDialog
          key={opened.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          route={opened.route}
          onAdded={(van) => {
            // The new van's page, its name focused (the dialog doesn't hand focus back).
            focusDetailWhenOpened(van.id);
            router.push(`/routes/${van.id}`);
          }}
        />
      )}
    </>
  );
}

/**
 * The key `pair` will have once `added` (an area just added or renamed) takes the place of the
 * name it was added for, at whichever end typed it (ignoring case, as the API links them).
 */
function pairKeyWith(pair: AreaPairDemand, name: string, added: AreaRef) {
  const typed = (value: string | null) =>
    value !== null && value.toLowerCase() === name.toLowerCase();
  return pairKey({
    ...pair,
    from_area: typed(pair.from_area_name) ? added : pair.from_area,
    from_area_name: typed(pair.from_area_name) ? null : pair.from_area_name,
    to_area: typed(pair.to_area_name) ? added : pair.to_area,
    to_area_name: typed(pair.to_area_name) ? null : pair.to_area_name,
  });
}

/** A pair's identity as the summary groups it: each end's area, or its name ignoring case. */
function pairKey(pair: AreaPairDemand) {
  return [
    pair.from_area?.id ?? pair.from_area_name?.toLowerCase(),
    pair.to_area?.id ?? pair.to_area_name?.toLowerCase(),
  ].join("|");
}

function Section({
  title,
  description,
  listLabel,
  empty,
  truncated,
  children,
}: {
  title: string;
  description: string;
  listLabel: string;
  empty: string;
  truncated: boolean;
  children: ReactNode[];
}) {
  const t = useTranslations("Demand");
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="grid gap-1">
        <h2
          id={headingId}
          className="font-display text-section font-semibold text-navy"
        >
          {title}
        </h2>
        <p className="text-body text-muted">{description}</p>
        {truncated && (
          <p className="text-table font-semibold text-ink">{t("truncated")}</p>
        )}
      </div>
      {children.length === 0 ? (
        <p className="rounded-xl bg-surface p-6 text-body text-muted ring-1 ring-line">
          {empty}
        </p>
      ) : (
        <ul
          aria-label={listLabel}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {children}
        </ul>
      )}
    </section>
  );
}

function Card({
  heading,
  children,
  pairKey,
}: {
  heading: ReactNode;
  children: ReactNode;
  pairKey?: string;
}) {
  return (
    <li
      data-pair-key={pairKey}
      className="grid content-start gap-4 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {heading}
      </div>
      {children}
    </li>
  );
}

const cardHeading = "font-display text-body font-semibold text-navy";
const linkClass =
  "w-fit text-table font-semibold text-royal underline-offset-4 hover:underline";

/**
 * The requests a pair's card counts (GZW-045): new new-areas requests between its two ends, each
 * a listed area's id or the name typed as not listed (a place, not personal data).
 */
function pairRequestsHref(pair: AreaPairDemand) {
  const query = new URLSearchParams({ kind: "new_areas", status: "new" });
  if (pair.from_area) query.set("from_area_id", pair.from_area.id);
  else if (pair.from_area_name)
    query.set("from_area_name", pair.from_area_name);
  if (pair.to_area) query.set("to_area_id", pair.to_area.id);
  else if (pair.to_area_name) query.set("to_area_name", pair.to_area_name);
  return `/route-requests?${query.toString()}`;
}

/**
 * An area pair: for two listed areas, add the corridor or the route (prefilled); an end typed as
 * not listed, add that area (prefilled), which links the requests to it (GZW-045). Its requests:
 * the ones it counts.
 */
function PairCard({
  pairKey,
  pair,
  open,
}: {
  pairKey: string;
  pair: AreaPairDemand;
  open: Open;
}) {
  const t = useTranslations("Demand");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const statusId = useId();
  const [finding, setFinding] = useState(false);
  const [findingProblem, setFindingProblem] = useState<unknown>(null);
  const [noCorridor, setNoCorridor] = useState(false);
  const waiting = useRetryWait(findingProblem);
  const end = (area: AreaRef | null, name: string | null) =>
    area?.name ?? (name === null ? "–" : t("notListed", { name }));
  const origin = pair.from_area;
  const destination = pair.to_area;
  // Each button names its pair to screen readers ("Add route, from Ayat to CMC"): the cards'
  // buttons would otherwise all sound the same.
  const forPair = (
    <span className="sr-only">
      {", "}
      {t("pairSpoken", {
        from: end(origin, pair.from_area_name),
        to: end(destination, pair.to_area_name),
      })}
    </span>
  );

  async function addRoute(from: AreaRef, to: AreaRef) {
    setFinding(true);
    setFindingProblem(null);
    setNoCorridor(false);
    try {
      const corridor = await fetchCorridorBetween(queryClient, from.id, to.id);
      if (corridor) open({ kind: "route", corridor });
      else setNoCorridor(true);
    } catch (error) {
      setFindingProblem(error);
    } finally {
      setFinding(false);
    }
  }

  return (
    <Card
      pairKey={pairKey}
      heading={
        <h3 tabIndex={-1} className={cardHeading}>
          {t.rich("pairName", {
            from: end(origin, pair.from_area_name),
            to: end(destination, pair.to_area_name),
            spoken: (chunks) => <span className="sr-only">{chunks}</span>,
            arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
          })}
        </h3>
      }
    >
      <p className="text-body text-ink">
        {t("openRequests", { count: pair.open })}
      </p>
      {/* A name not listed yet: add the area. The API links the open requests that typed it, and
          the card then counts them under the area. */}
      {(origin === null || destination === null) && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              [origin, pair.from_area_name],
              [destination, pair.to_area_name],
            ] as const
          ).map(([area, name]) =>
            area === null && name !== null ? (
              <Button
                key={name}
                variant="secondary"
                size="sm"
                onClick={() => open({ kind: "area", name, pair })}
              >
                {t("addArea", { name })}
                {forPair}
              </Button>
            ) : null,
          )}
        </div>
      )}
      {origin && destination && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNoCorridor(false);
              open({ kind: "corridor", origin, destination });
            }}
          >
            {t("addCorridor")}
            {forPair}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            pending={finding}
            aria-disabled={waiting || undefined}
            aria-describedby={noCorridor ? statusId : undefined}
            onClick={() => void addRoute(origin, destination)}
          >
            {t("addRoute")}
            {forPair}
          </Button>
        </div>
      )}
      {/* Always in the page (a live region announces changes, not its arrival); no space when empty. */}
      <p
        id={statusId}
        role="status"
        className={noCorridor ? "text-table text-muted" : "sr-only"}
      >
        {noCorridor ? t("noCorridor") : ""}
      </p>
      {findingProblem !== null && (
        <ProblemAlert
          message={message(findingProblem)}
          requestId={
            findingProblem instanceof ApiError ? findingProblem.requestId : null
          }
          retryAfterSeconds={
            findingProblem instanceof ApiError
              ? findingProblem.retryAfterSeconds
              : null
          }
          onRetry={
            origin && destination && !waiting
              ? () => void addRoute(origin, destination)
              : undefined
          }
        />
      )}
      <Link href={pairRequestsHref(pair)} className={linkClass}>
        {t("seePairRequests")}
        {forPair}
      </Link>
    </Card>
  );
}

/** A route with open requests: open it, see its requests, or add a van (GZW-028). */
function RouteCard({ demand, open }: { demand: RouteDemand; open: Open }) {
  const t = useTranslations("Demand");
  const tStatus = useTranslations("RouteStatus");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const { route, status } = demand;

  async function addVan() {
    setLoading(true);
    setProblem(null);
    try {
      open({ kind: "van", route: await fetchRoute(queryClient, route.id) });
    } catch (error) {
      setProblem(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      heading={
        <>
          <h3 className={`${cardHeading} font-mono`}>{route.code}</h3>
          <StatusPill tone={statusTones[status]}>
            {status === "forming"
              ? tStatus("formingNoMinimum")
              : tStatus(status)}
          </StatusPill>
        </>
      }
    >
      <p className="grid gap-0.5 text-body text-ink">
        <span>{t("openRequests", { count: demand.open })}</span>
        <span className="text-table text-muted">
          {t("seatsFree", { count: demand.seats_free_next_month })}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="secondary"
          size="sm"
          pending={loading}
          aria-disabled={waiting || undefined}
          onClick={() => void addVan()}
        >
          {t("addVan")}
          <span className="sr-only">
            {", "}
            {route.code}
          </span>
        </Button>
        <Link href={`/routes/${route.id}`} className={linkClass}>
          {t("openRoute", { code: route.code })}
        </Link>
        <Link
          href={`/route-requests?route_id=${route.id}&open=true`}
          className={linkClass}
        >
          {t("seeRouteRequests", { code: route.code })}
        </Link>
      </div>
      {problem !== null && (
        <ProblemAlert
          message={message(problem)}
          requestId={problem instanceof ApiError ? problem.requestId : null}
          retryAfterSeconds={
            problem instanceof ApiError ? problem.retryAfterSeconds : null
          }
          onRetry={waiting ? undefined : () => void addVan()}
        />
      )}
    </Card>
  );
}
