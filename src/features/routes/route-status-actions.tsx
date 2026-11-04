"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LaunchProgress } from "@/components/launch-progress";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { cn } from "@/lib/utils";
import { refetchRoute, useLaunchMonths, useSetRouteStatus } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type RouteStatus = components["schemas"]["RouteStatus"];
type StatusChange = components["schemas"]["StatusChange"];

type Move =
  | "StartForming"
  | "BackToDraft"
  | "Launch"
  | "StartService"
  | "Pause"
  | "Resume";

/** The move's name, by where the route is and where it goes (milestones.md, GZW-024). */
function moveOf(from: RouteStatus, to: RouteStatus): Move {
  if (to === "forming") return "StartForming";
  if (to === "draft") return "BackToDraft";
  if (to === "paused") return "Pause";
  if (from === "forming") return "Launch";
  if (from === "draft") return "StartService";
  return "Resume";
}

/**
 * Whether a move's button can be used: when the API says it's ready, and for a launch also when
 * the only blocker is riders. The API judges a launch for the earliest month only, and a later
 * month may already have enough riders: the launch dialog lists them, ready or not (owner
 * decision, GZW-024).
 */
function usable(move: Move, change: StatusChange) {
  if (change.ready) return true;
  return (
    move === "Launch" &&
    change.blocked_by.every((blocker) => blocker === "NOT_ENOUGH_RIDERS")
  );
}

/** A launch day ("2026-12-01") as a date, for formatting (UTC: it's a calendar day). */
const day = (value: string) => new Date(`${value}T00:00:00Z`);

/**
 * A route's status moves (design-system.md, "Status actions"): one button per move its
 * `status_changes` allows. A move that isn't ready stays visible but can't be used, its reasons
 * written under it – the UI never works the rules out itself. Moves are confirmed; a launch picks
 * its month.
 */
export function RouteStatusActions({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  const format = useFormatter();
  // The move as it was when its button was pressed (and the route then): a successful move
  // changes the route's status, and the open dialog must stay the move it was.
  const [open, setOpen] = useState<{
    change: StatusChange;
    move: Move;
    route: RouteRead;
    key: number;
  } | null>(null);
  const baseId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  // After a move the buttons change (the one pressed may be gone): focus goes to the moves. So it
  // does after a refusal that reloaded the route without its button, rather than falling to the
  // page. After the closing dialog's own focus return, which Radix runs in a timeout as it
  // unmounts (focusing now would be undone by it).
  const focusAfterClose = useRef<"moved" | "refused" | null>(null);
  useEffect(() => {
    const after = focusAfterClose.current;
    if (open !== null || after === null) return;
    focusAfterClose.current = null;
    const timer = setTimeout(() => {
      const lost =
        document.activeElement === document.body ||
        document.activeElement?.id === "content";
      if (after === "moved" || lost) groupRef.current?.focus();
    });
    return () => clearTimeout(timer);
  }, [open]);

  if (route.status_changes.length === 0) {
    return <p className="text-body text-muted">{t("noMoves")}</p>;
  }

  function reasons(change: StatusChange): string[] {
    return change.blocked_by.map((blocker) => {
      if (blocker === "PRICES_MISSING") return t("blockedPrices");
      if (blocker === "COMPANY_INACTIVE") return t("blockedCompany");
      if (blocker === "ROUTE_HAS_RIDERS") return t("blockedRiders");
      return t("blockedNotEnough", {
        reserved: route.reserved,
        minimum: route.launch_minimum ?? 0,
        month: change.launch_date
          ? format.dateTime(day(change.launch_date), {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })
          : "",
      });
    });
  }

  return (
    <div
      ref={groupRef}
      tabIndex={-1}
      role="group"
      aria-label={t("statusActionsLabel")}
      className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-lg outline-none"
    >
      {route.status_changes.map((change) => {
        const move = moveOf(route.status, change.to);
        const why = reasons(change);
        const reasonsId = `${baseId}-${change.to}`;
        return (
          <div key={change.to} className="grid max-w-xs gap-1.5">
            <Button
              variant={
                move === "Launch" || move === "StartService"
                  ? "primary"
                  : "secondary"
              }
              className="w-fit"
              aria-disabled={!usable(move, change) || undefined}
              aria-describedby={why.length > 0 ? reasonsId : undefined}
              onClick={() =>
                setOpen((previous) => ({
                  change,
                  move,
                  route,
                  key: (previous?.key ?? 0) + 1,
                }))
              }
            >
              {t(`move${move}`)}
            </Button>
            {why.length > 0 && (
              <ul id={reasonsId} className="grid gap-0.5 text-table text-muted">
                {why.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {open !== null &&
        (open.move === "Launch" ? (
          <LaunchDialog
            key={open.key}
            route={open.route}
            change={open.change}
            onClose={(moved) => {
              focusAfterClose.current = moved ? "moved" : "refused";
              setOpen(null);
            }}
          />
        ) : (
          <MoveDialog
            key={open.key}
            route={open.route}
            change={open.change}
            move={open.move}
            onClose={(moved) => {
              focusAfterClose.current = moved ? "moved" : "refused";
              setOpen(null);
            }}
          />
        ))}
    </div>
  );
}

/** What a 409 or 422 from `routes_set_status` means here; anything else, the usual message. */
function useRefusalMessage() {
  const t = useTranslations("Routes");
  const { message } = useApiErrorMessages();
  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === "ROUTE_NOT_READY") return t("refuseNotReady");
      if (error.code === "NOT_ENOUGH_RIDERS") return t("refuseNotEnough");
      if (error.code === "ROUTE_HAS_RIDERS") return t("refuseHasRiders");
      if (error.code === "INVALID_STATUS_CHANGE") return t("refuseInvalid");
      if (
        error.fieldErrors.some(
          (fieldError) => fieldError.path === "launch_date",
        )
      ) {
        return t("launchDateRefused");
      }
    }
    return message(error);
  };
}

/** The new status's name for the toast ("Forming", not "Forming · 7 of 10"). */
function useStatusName() {
  const tStatus = useTranslations("RouteStatus");
  return (status: RouteStatus) =>
    status === "forming" ? tStatus("formingNoMinimum") : tStatus(status);
}

/** Every move but a launch: a confirmation saying what happens. */
function MoveDialog({
  route,
  change,
  move,
  onClose,
}: {
  route: RouteRead;
  change: StatusChange;
  move: Exclude<Move, "Launch">;
  /** `moved`: the move succeeded. */
  onClose: (moved: boolean) => void;
}) {
  const t = useTranslations("Routes");
  const refusal = useRefusalMessage();
  const statusName = useStatusName();
  const queryClient = useQueryClient();
  const setStatus = useSetRouteStatus();
  const error = setStatus.error;
  const waiting = useRetryWait(error);
  const values = {
    code: route.code,
    minimum: route.launch_minimum ?? 0,
    company: route.company?.name ?? "",
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (next) return;
        // Deleted meanwhile: its detail shows that once the dialog closes.
        if (error instanceof ApiError && error.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        onClose(false);
      }}
      title={t(`confirm${move}Title`, values)}
      description={t(`confirm${move}Description`, values)}
      confirmLabel={t(`move${move}`)}
      pending={setStatus.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        setStatus.mutate(
          { id: route.id, change: { status: change.to } },
          {
            onSuccess: (saved) => {
              showSuccessToast(
                t("statusChanged", {
                  code: saved.code,
                  status: statusName(saved.status),
                }),
              );
              onClose(true);
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={refusal(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}

/**
 * A launch: the launch months as a radio list (riders reserved, ready or not); months that aren't
 * ready can't be chosen. A later month makes the route active now, riders starting that day.
 */
function LaunchDialog({
  route,
  change,
  onClose,
}: {
  route: RouteRead;
  change: StatusChange;
  /** `moved`: the launch succeeded. */
  onClose: (moved: boolean) => void;
}) {
  const t = useTranslations("Routes");
  const tCommon = useTranslations("Common");
  const tStatus = useTranslations("RouteStatus");
  const queryClient = useQueryClient();
  const format = useFormatter();
  const { message } = useApiErrorMessages();
  const refusal = useRefusalMessage();
  const months = useLaunchMonths(route.id, true);
  const setStatus = useSetRouteStatus();
  const [chosen, setChosen] = useState<string | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const legendId = useId();
  const whyId = useId();
  const error = setStatus.error;
  const waiting = useRetryWait(error);

  const list = months.data?.months ?? [];
  const ready = list.filter((month) => month.ready);
  // The move's own day when it's ready, else the first ready month.
  const fallback =
    ready.find((month) => month.launch_date === change.launch_date)
      ?.launch_date ??
    ready[0]?.launch_date ??
    null;
  // A month the person chose that isn't ready any more (the months reloaded) isn't swapped for
  // another behind their back: nothing is selected, and they're told.
  const chosenGone =
    chosen !== null && !ready.some((month) => month.launch_date === chosen);
  const selected = chosen === null ? fallback : chosenGone ? null : chosen;
  const minimum = months.data?.launch_minimum ?? route.launch_minimum ?? 0;
  const monthName = (value: string) =>
    format.dateTime(day(value), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const longDate = (value: string) =>
    format.dateTime(day(value), { dateStyle: "long", timeZone: "UTC" });

  function launch() {
    if (selected === null) return;
    setStatus.mutate(
      {
        id: route.id,
        change: { status: "active", launch_date: selected },
      },
      {
        onSuccess: (saved) => {
          // Unchanged (someone launched it meanwhile): the API answers without changing it.
          showSuccessToast(
            saved.updated_at === route.updated_at
              ? t("statusChanged", {
                  code: saved.code,
                  status: tStatus("active"),
                })
              : t("launched", { code: saved.code, date: longDate(selected) }),
          );
          onClose(true);
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (setStatus.isPending && !next) return;
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        onClose(false);
      }}
    >
      <DialogContent
        className="max-w-lg"
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("launchTitle", { code: route.code })}</DialogTitle>
          <DialogDescription>{t("launchHint")}</DialogDescription>
        </div>

        {error && (
          <ProblemAlert
            message={refusal(error)}
            requestId={error instanceof ApiError ? error.requestId : null}
            retryAfterSeconds={
              error instanceof ApiError ? error.retryAfterSeconds : null
            }
          />
        )}

        {months.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : months.isError ? (
          <ProblemAlert
            message={message(months.error)}
            requestId={
              months.error instanceof ApiError ? months.error.requestId : null
            }
            retryAfterSeconds={
              months.error instanceof ApiError
                ? months.error.retryAfterSeconds
                : null
            }
            onRetry={() => void months.refetch()}
          />
        ) : (
          <div className="grid gap-2">
            <p id={legendId} className="text-table font-semibold text-ink">
              {t("launchMonthsLabel")}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={legendId}
              className="grid max-h-72 gap-1 overflow-y-auto"
            >
              {list.map((month) => (
                <label
                  key={month.launch_date}
                  className={cn(
                    "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 rounded-lg border border-line px-3 py-2",
                    month.ready
                      ? "cursor-pointer has-checked:border-royal has-checked:bg-ice"
                      : "cursor-not-allowed opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    name="launch-month"
                    value={month.launch_date}
                    checked={selected === month.launch_date}
                    disabled={!month.ready}
                    onChange={() => setChosen(month.launch_date)}
                    className="row-span-2 size-4 accent-royal"
                  />
                  <span className="text-body text-ink">
                    {monthName(month.launch_date)}
                  </span>
                  <span className="text-meta text-muted">
                    {t("launchMonthState", {
                      reserved: month.reserved,
                      minimum,
                      state: month.ready
                        ? t("launchMonthReady")
                        : t("launchMonthNotReady"),
                    })}
                  </span>
                  {minimum > 0 && (
                    // The same numbers as a meter (design-system.md, LaunchProgress); the label's
                    // text already says them.
                    <span aria-hidden className="col-start-2">
                      <LaunchProgress
                        reserved={month.reserved}
                        minimum={minimum}
                        barOnly
                      />
                    </span>
                  )}
                </label>
              ))}
            </div>
            {ready.length === 0 && (
              <p id={whyId} className="text-table text-muted">
                {t("launchNoReadyMonth")}
              </p>
            )}
            {chosenGone && chosen !== null && ready.length > 0 && (
              <p id={whyId} role="status" className="text-table text-danger">
                {t("launchChosenGone", { month: monthName(chosen) })}
              </p>
            )}
            {selected !== null && (
              // Whatever the month: the route is active from now; riders start that day.
              <p className="text-table text-ink">
                {t("launchStarts", { date: longDate(selected) })}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button
              variant="secondary"
              aria-disabled={setStatus.isPending || undefined}
            >
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button
            pending={setStatus.isPending}
            aria-disabled={selected === null || waiting || undefined}
            aria-describedby={selected === null ? whyId : undefined}
            onClick={launch}
          >
            {t("moveLaunch")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
