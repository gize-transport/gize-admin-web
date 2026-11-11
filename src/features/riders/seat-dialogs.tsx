"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { useTimestampFormat } from "@/lib/time";
import {
  refetchRider,
  useCompanySeatRoutes,
  useEndSeat,
  usePlaceRider,
  useTripRoutes,
} from "./queries";
import { planLabel, todayInAddis } from "./rider-labels";
import { latestDay, monthEnds, startMonths } from "./seat-dates";

type RiderRead = components["schemas"]["RiderRead"];
type RouteRef = components["schemas"]["RouteRef"];
type RouteStatus = components["schemas"]["RouteStatus"];

/** The contract's limit for `skip_reason`. */
const REASON_MAX = 100;

/** A route a rider may be offered: from the trip's list (adults) or their company's. */
type SeatRoute = {
  id: string;
  code: string;
  from: string;
  to: string;
  status: RouteStatus;
  times: string;
  /** No seat free from the earliest start ("Full"), or the seats free this month; null: unknown. */
  full: boolean;
  freeThisMonth: number | null;
  /**
   * Why an adult can't have it now, as the API's rules say (riders_place): a paused route takes no
   * one; Saturday riders need a route with a Saturday price. Shown, not chosen; the API decides.
   */
  unavailable: "paused" | "noSaturday" | null;
};

const selectClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-body text-ink hover:border-muted aria-invalid:border-danger";

/** "December 2026" for a 1st, "Nov 30, 2026" for any other day. */
function useDayNames() {
  const format = useFormatter();
  const { day } = useTimestampFormat();
  return {
    month: (value: string) =>
      format.dateTime(new Date(`${value}T00:00:00Z`), {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    day,
  };
}

/** The routes this rider can be offered, with their loading and error state. */
function useSeatRoutes(rider: RiderRead) {
  const company = rider.rider_type === "corporate";
  const trip = useTripRoutes(
    company ? null : (rider.home_area?.id ?? null),
    company ? null : (rider.destination_area?.id ?? null),
  );
  const own = useCompanySeatRoutes(
    company ? (rider.company?.id ?? null) : null,
  );
  const query = company ? own : trip;
  let routes: SeatRoute[] | undefined;
  if (company) {
    routes = own.data?.items.map((route) => ({
      id: route.id,
      code: route.code,
      from: route.corridor.origin_area.name,
      to: route.corridor.destination_area.name,
      status: route.status,
      times: `${route.morning_time}–${route.return_time}`,
      full: route.seats_free.this_month <= 0,
      freeThisMonth: route.seats_free.this_month,
      unavailable: null,
    }));
  } else {
    routes = trip.data?.items.map((route) => ({
      id: route.id,
      code: route.code,
      from: route.origin_area.name,
      to: route.destination_area.name,
      status: route.status,
      times: `${route.morning_time}–${route.return_time}`,
      full: route.full,
      freeThisMonth: null,
      unavailable:
        route.status === "paused"
          ? "paused"
          : rider.saturday_addon && route.prices.saturday === null
            ? "noSaturday"
            : null,
    }));
  }
  // Without both areas (or a company) the routes can't be looked up: no list, nothing loading.
  const noTrip = company
    ? rider.company === null
    : rider.home_area === null || rider.destination_area === null;
  return { query, routes, noTrip };
}

type PlaceSeatDialogProps = {
  rider: RiderRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A full running route: record a route request for it instead (the caller opens the form). */
  onRecordRequest: (route: RouteRef) => void;
};

/**
 * Place a rider on a route, or move them to another (GZW-031). The route takes where they board,
 * where they go, their plan and Saturday from the rider; the dialog asks only which route and from
 * when. Mount it with a new `key` each time it opens: one Idempotency-Key per opening, kept for its
 * retries (a refused attempt changes nothing, so the same key may carry a corrected one).
 */
export function PlaceSeatDialog({
  rider,
  open,
  onOpenChange,
  onRecordRequest,
}: PlaceSeatDialogProps) {
  const t = useTranslations("Riders");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const { month } = useDayNames();
  const place = usePlaceRider();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [today] = useState(() => todayInAddis());
  const company = rider.rider_type === "corporate";
  const moving = rider.seat !== null;
  const months = startMonths(today);
  const { query, routes, noTrip } = useSeatRoutes(rider);
  // Moving: their current route isn't a move (Keep handles it).
  const offered = routes?.filter((route) => route.id !== rider.seat?.route_id);

  const [routeId, setRouteId] = useState<string | null>(null);
  const [start, setStart] = useState(company ? today : (months[0] ?? ""));
  const [reason, setReason] = useState("");
  // The route that asked for a reason ("others asked first"): only it needs one.
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    route?: string;
    start?: string;
    reason?: string;
  }>({});
  const [problem, setProblem] = useState<unknown>(null);
  // The route a refusal was about (the choice may change after).
  const [sentRoute, setSentRoute] = useState<SeatRoute | null>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const routeGroup = useRef<HTMLDivElement>(null);
  const startField = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const [handedOver, setHandedOver] = useState(false);
  // The reason box takes focus once it's on screen (after a "others asked first" refusal).
  const [focusReason, setFocusReason] = useState(0);
  useEffect(() => {
    if (focusReason > 0) reasonField.current?.focus();
  }, [focusReason]);

  const chosen = offered?.find((route) => route.id === routeId) ?? null;
  const needsReason = reasonFor !== null && reasonFor === routeId;

  /** The chosen radio, else the first, else the group itself (nothing listed). */
  function focusRoutes() {
    const group = routeGroup.current;
    (
      group?.querySelector<HTMLInputElement>("input:checked") ??
      group?.querySelector<HTMLInputElement>("input:not(:disabled)") ??
      group
    )?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (place.isPending) return;
    const found: typeof errors = {};
    if (!chosen) found.route = t("seatRouteRequired");
    if (!start) found.start = t("seatStartRequired");
    const trimmed = reason.trim();
    if (needsReason && !trimmed) found.reason = t("skipReasonRequired");
    setErrors(found);
    if (found.route) return focusRoutes();
    if (found.start) return startField.current?.focus();
    if (found.reason) return reasonField.current?.focus();
    if (!chosen) return;
    setProblem(null);
    setSentRoute(chosen);
    place.mutate(
      {
        id: rider.id,
        idempotencyKey,
        placement: {
          route_id: chosen.id,
          start_date: start,
          ...(needsReason ? { skip_reason: trimmed } : {}),
        },
      },
      {
        onSuccess: () => {
          showSuccessToast(t(moving ? "movedToast" : "placedToast"));
          onOpenChange(false);
        },
        onError: (error) => {
          if (
            error instanceof ApiError &&
            error.code === "ROUTE_HAS_WAITING_REQUESTS"
          ) {
            setReasonFor(chosen.id);
            setErrors({ reason: t("skipReasonNeeded") });
            setFocusReason((count) => count + 1);
            return;
          }
          const fields = fieldMessages(error);
          if (fields.route_id || fields.start_date) {
            setErrors({
              route: fields.route_id
                ? t(company ? "seatRouteRefusedCompany" : "seatRouteRefused")
                : undefined,
              start: fields.start_date
                ? t(company ? "seatStartDayRefused" : "seatStartMonthRefused")
                : undefined,
            });
            if (fields.route_id) focusRoutes();
            else startField.current?.focus();
            return;
          }
          setProblem(error);
        },
      },
    );
  }

  const full = problem instanceof ApiError && problem.code === "ROUTE_FULL";
  // A request can name a running (or paused) route only; for adults (a student's names their
  // school and guardian, GZ-033).
  const canRequest =
    full &&
    rider.rider_type === "adult" &&
    sentRoute !== null &&
    (sentRoute.status === "active" || sentRoute.status === "paused");
  let problemWords = problem !== null ? message(problem) : "";
  if (full && sentRoute) {
    problemWords = t(canRequest ? "seatFullRequest" : "seatFull", {
      code: sentRoute.code,
    });
  } else if (
    problem instanceof ApiError &&
    problem.code === "ROUTE_NOT_READY" &&
    company
  ) {
    problemWords = t("seatCompanyInactive", {
      company: rider.company?.name ?? "",
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (place.isPending && !next) return;
        if (!next && problem instanceof ApiError && problem.status === 404) {
          refetchRider(queryClient, rider.id);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          // Handed over to the route request form: it takes focus itself.
          if (handedOver) event.preventDefault();
          else returnFocus(event, returnFocusTo.current);
        }}
      >
        <div className="grid gap-1">
          <DialogTitle>
            {t(moving ? "moveTitle" : "placeTitle", { name: rider.full_name })}
          </DialogTitle>
          <DialogDescription>
            {company
              ? t("placeHintCompany", {
                  company: rider.company?.name ?? "",
                  home: rider.home_area?.name ?? "",
                })
              : t("placeHintAdult", {
                  home: rider.home_area?.name ?? t("notSet"),
                  destination: rider.destination_area?.name ?? t("notSet"),
                  plan: planLabel(rider, t) ?? t("notSet"),
                })}
          </DialogDescription>
        </div>
        <form noValidate onSubmit={submit} className="grid gap-5">
          {problem !== null && (
            <div className="grid gap-2">
              <ProblemAlert
                message={problemWords}
                requestId={
                  problem instanceof ApiError ? problem.requestId : null
                }
                retryAfterSeconds={
                  problem instanceof ApiError ? problem.retryAfterSeconds : null
                }
              />
              {canRequest && sentRoute && (
                <Button
                  variant="secondary"
                  className="w-fit"
                  onClick={() => {
                    setHandedOver(true);
                    onOpenChange(false);
                    onRecordRequest({ id: sentRoute.id, code: sentRoute.code });
                  }}
                >
                  {t("seatRecordRequest", { code: sentRoute.code })}
                </Button>
              )}
            </div>
          )}

          {moving && rider.seat && (
            <p className="rounded-lg bg-ice px-4 py-3 text-table text-navy">
              {t("moveNote", { code: rider.seat.route_code })}
            </p>
          )}

          <div
            ref={routeGroup}
            role="radiogroup"
            tabIndex={-1}
            className="grid gap-2 outline-none"
            aria-labelledby={`${uid}-route-label`}
            aria-describedby={errors.route ? `${uid}-route-error` : undefined}
            aria-invalid={errors.route ? true : undefined}
          >
            <p
              id={`${uid}-route-label`}
              className="mb-1 text-table font-semibold text-ink"
            >
              {t(company ? "seatRouteLegendCompany" : "seatRouteLegend")}
            </p>
            {noTrip ? (
              <p className="text-body text-muted">
                {t(company ? "seatNoCompany" : "seatNoTrip")}
              </p>
            ) : query.isPending ? (
              <div className="grid gap-2" aria-busy="true">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : query.isError ? (
              <ProblemAlert
                message={message(query.error)}
                requestId={
                  query.error instanceof ApiError ? query.error.requestId : null
                }
                retryAfterSeconds={
                  query.error instanceof ApiError
                    ? query.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void query.refetch()}
              />
            ) : offered && offered.length > 0 ? (
              <div className="grid gap-2">
                {offered.map((route) => (
                  <RouteOption
                    key={route.id}
                    route={route}
                    checked={route.id === routeId}
                    onChoose={() => {
                      setRouteId(route.id);
                      setErrors((current) => ({
                        ...current,
                        route: undefined,
                      }));
                    }}
                    name={`${uid}-route`}
                    describedBy={
                      errors.route ? `${uid}-route-error` : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-body text-muted">
                {routes && routes.length > 0
                  ? t("seatNoOtherRoutes")
                  : company
                    ? t("seatNoCompanyRoutes", {
                        company: rider.company?.name ?? "",
                      })
                    : t("seatNoTripRoutes")}
              </p>
            )}
            {errors.route && (
              <p id={`${uid}-route-error`} className="text-table text-danger">
                {errors.route}
              </p>
            )}
          </div>

          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor={`${uid}-start`}>
              {t(company ? "seatStartDay" : "seatStartMonth")}
            </Label>
            {company ? (
              <Input
                id={`${uid}-start`}
                ref={(element) => {
                  startField.current = element;
                }}
                type="date"
                min={today}
                max={latestDay(today)}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-invalid={errors.start ? true : undefined}
                aria-describedby={
                  errors.start ? `${uid}-start-error` : undefined
                }
              />
            ) : (
              <select
                id={`${uid}-start`}
                ref={(element) => {
                  startField.current = element;
                }}
                className={selectClass}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-invalid={errors.start ? true : undefined}
                aria-describedby={
                  errors.start
                    ? `${uid}-start-hint ${uid}-start-error`
                    : `${uid}-start-hint`
                }
              >
                {months.map((value) => (
                  <option key={value} value={value}>
                    {month(value)}
                  </option>
                ))}
              </select>
            )}
            {!company && (
              <p id={`${uid}-start-hint`} className="text-table text-muted">
                {t("seatStartHint")}
              </p>
            )}
            {errors.start && (
              <p id={`${uid}-start-error`} className="text-table text-danger">
                {errors.start}
              </p>
            )}
          </div>

          {needsReason && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${uid}-reason`}>{t("skipReasonLabel")}</Label>
              <Textarea
                id={`${uid}-reason`}
                ref={reasonField}
                rows={2}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={errors.reason ? true : undefined}
                aria-describedby={`${uid}-reason-hint${
                  errors.reason ? ` ${uid}-reason-error` : ""
                }`}
              />
              <p id={`${uid}-reason-hint`} className="text-table text-muted">
                {t("skipReasonHint")}
              </p>
              {errors.reason && (
                <p
                  id={`${uid}-reason-error`}
                  className="text-table text-danger"
                >
                  {errors.reason}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="secondary"
                aria-disabled={place.isPending || undefined}
              >
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={place.isPending}
              aria-disabled={waiting || undefined}
            >
              {t(moving ? "moveSave" : "placeSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const statusKeys = {
  draft: "routeDraft",
  forming: "routeForming",
  active: "routeRunning",
  paused: "routePaused",
} as const;

/** One route to choose: code, A → B, times, its state and whether it's full. */
function RouteOption({
  route,
  checked,
  onChoose,
  name,
  describedBy,
}: {
  route: SeatRoute;
  checked: boolean;
  onChoose: () => void;
  name: string;
  describedBy?: string;
}) {
  const t = useTranslations("Riders");
  const uid = useId();
  const unavailable = route.unavailable;
  return (
    <label
      className={
        unavailable
          ? "flex items-start gap-3 rounded-lg border border-line p-3 text-muted"
          : "flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-royal has-[:checked]:bg-ice"
      }
    >
      <input
        type="radio"
        name={name}
        value={route.id}
        checked={checked}
        disabled={unavailable !== null}
        onChange={onChoose}
        aria-describedby={
          [unavailable ? `${uid}-why` : null, describedBy]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="mt-1 size-4 shrink-0 accent-royal"
      />
      <span className="grid min-w-0 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-ink">{route.code}</span>
          <StatusPill tone={route.status === "active" ? "success" : "neutral"}>
            {t(statusKeys[route.status])}
          </StatusPill>
          {route.full && (
            <StatusPill tone="danger">{t("routeFull")}</StatusPill>
          )}
        </span>
        <span className="text-table text-ink">
          {t.rich("routeEnds", {
            from: route.from,
            to: route.to,
            spoken: (chunks) => <span className="sr-only">{chunks}</span>,
            arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
          })}
          {" · "}
          {route.times}
        </span>
        {unavailable && (
          <span id={`${uid}-why`} className="text-meta text-muted">
            {t(
              unavailable === "paused" ? "routePausedNote" : "routeNoSaturday",
            )}
          </span>
        )}
        {route.freeThisMonth !== null && !route.full && (
          <span className="text-meta text-muted">
            {t("seatsFreeThisMonth", { count: route.freeThisMonth })}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * The rider leaves their route (GZW-031): an adult at a month's end, a company rider on any day. A
 * reservation, a seat not started by then, or a move still to come ends at once.
 */
export function EndSeatDialog({
  rider,
  open,
  onOpenChange,
}: {
  rider: RiderRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Riders");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const { day } = useDayNames();
  const end = useEndSeat();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [today] = useState(() => todayInAddis());
  const company = rider.rider_type === "corporate";
  // A seat already ending (and no move) can only end earlier: the API keeps an earlier end.
  const endsBy =
    rider.seat?.end_date && !rider.next_seat ? rider.seat.end_date : null;
  const ends = monthEnds(today).filter((value) => !endsBy || value <= endsBy);
  const latest = endsBy ?? latestDay(today);
  const [last, setLast] = useState(company ? today : (ends[0] ?? ""));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const lastField = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const code = rider.seat?.route_code ?? "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (end.isPending) return;
    if (!last) {
      setFieldError(t("endDayRequired"));
      lastField.current?.focus();
      return;
    }
    setFieldError(null);
    setProblem(null);
    end.mutate(
      { id: rider.id, idempotencyKey, ending: { end_date: last } },
      {
        onSuccess: () => {
          showSuccessToast(t("endedToast"));
          onOpenChange(false);
        },
        onError: (error) => {
          if (fieldMessages(error).end_date) {
            setFieldError(t(company ? "endDayRefused" : "endMonthRefused"));
            lastField.current?.focus();
            return;
          }
          setProblem(error);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (end.isPending && !next) return;
        if (!next && problem instanceof ApiError && problem.status === 404) {
          refetchRider(queryClient, rider.id);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("endTitle", { code })}</DialogTitle>
          <DialogDescription>
            {t(company ? "endHintCompany" : "endHintAdult")}
          </DialogDescription>
        </div>
        <form noValidate onSubmit={submit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={message(problem)}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor={`${uid}-last`}>{t("endDayLabel")}</Label>
            {company ? (
              <Input
                id={`${uid}-last`}
                ref={(element) => {
                  lastField.current = element;
                }}
                type="date"
                min={today}
                max={latest}
                value={last}
                onChange={(event) => setLast(event.target.value)}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? `${uid}-last-error` : undefined}
              />
            ) : (
              <select
                id={`${uid}-last`}
                ref={(element) => {
                  lastField.current = element;
                }}
                className={selectClass}
                value={last}
                onChange={(event) => setLast(event.target.value)}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? `${uid}-last-error` : undefined}
              >
                {ends.map((value) => (
                  <option key={value} value={value}>
                    {day(value)}
                  </option>
                ))}
              </select>
            )}
            {fieldError && (
              <p id={`${uid}-last-error`} className="text-table text-danger">
                {fieldError}
              </p>
            )}
          </div>
          {endsBy && (
            <p className="text-table text-muted">
              {t("endAlreadyEnding", {
                date: day(endsBy),
                code: rider.seat?.route_code ?? "",
              })}
            </p>
          )}
          <p className="text-table text-muted">
            {rider.next_seat
              ? // The move is cancelled only if they leave before it starts.
                last && last < rider.next_seat.start_date
                ? t("endNoteMoving", { code: rider.next_seat.route_code })
                : t("endNoteAfterMove", {
                    code: rider.next_seat.route_code,
                    date: day(rider.next_seat.start_date),
                  })
              : t("endNote")}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="secondary"
                aria-disabled={end.isPending || undefined}
              >
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              pending={end.isPending}
              aria-disabled={waiting || undefined}
            >
              {t("endSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Keep the rider on their route (GZW-031): the seat stops ending, and a move still to come is
 * cancelled. The API's "place on the route they hold".
 */
export function KeepSeatDialog({
  rider,
  open,
  onClose,
}: {
  rider: RiderRead;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Riders");
  const { message } = useApiErrorMessages();
  const { day } = useDayNames();
  const queryClient = useQueryClient();
  const place = usePlaceRider();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // As the dialog opened: a refusal reloads the rider, and the words mustn't change under it.
  const [seat] = useState(rider.seat);
  const [nextSeat] = useState(rider.next_seat);
  const error = place.error;
  const waiting = useRetryWait(error);
  if (!seat) return null;
  const full = error instanceof ApiError && error.code === "ROUTE_FULL";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Gone (deleted meanwhile): their detail shows that once the dialog closes.
        if (error instanceof ApiError && error.status === 404) {
          refetchRider(queryClient, rider.id);
        }
        place.reset();
        onClose();
      }}
      title={t("keepTitle", { code: seat.route_code })}
      description={
        nextSeat
          ? t("keepMovingDescription", {
              code: seat.route_code,
              next: nextSeat.route_code,
            })
          : t("keepEndingDescription", {
              code: seat.route_code,
              date: day(seat.end_date ?? ""),
            })
      }
      confirmLabel={t("keepSave", { code: seat.route_code })}
      pending={place.isPending}
      confirmDisabled={waiting || full}
      onConfirm={() =>
        place.mutate(
          {
            id: rider.id,
            idempotencyKey,
            placement: { route_id: seat.route_id },
          },
          {
            onSuccess: () => {
              showSuccessToast(t("keptToast"));
              onClose();
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={
            full ? t("keepFull", { code: seat.route_code }) : message(error)
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
