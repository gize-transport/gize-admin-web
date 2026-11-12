"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type FormEvent,
} from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { todayInAddis } from "@/features/riders/rider-labels";
import { startMonths } from "@/features/riders/seat-dates";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { useTimestampFormat } from "@/lib/time";
import {
  offerKeys,
  useAcceptOffer,
  useCreateOffer,
  useOfferQueue,
  useRouteOffers,
  useWithdrawOffer,
} from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type OfferRead = components["schemas"]["OfferRead"];
type OfferStatus = components["schemas"]["OfferStatus"];
type OfferQueueItem = components["schemas"]["OfferQueueItem"];

/** The contract's limit for `skip_reason`. */
const REASON_MAX = 100;

const tones: Record<OfferStatus, StatusTone> = {
  open: "waiting",
  accepted: "success",
  expired: "neutral",
  withdrawn: "neutral",
};

const selectClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-body text-ink hover:border-muted aria-invalid:border-danger";

/** "December 2026" for a seat's first day (a 1st). */
function useMonthName() {
  const format = useFormatter();
  return (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
}

/**
 * A public route's seat offers (GZW-042): newest first, with their state, expiry and text
 * message. Staff offer a free seat (48 hours, held meanwhile) to whoever has waited longest, or to
 * a request they choose (with a reason), accept an offer for someone who said yes on the phone,
 * or withdraw it.
 */
export function SeatOffers({
  route,
  SectionHeading,
  headingClass,
}: {
  route: RouteRead;
  SectionHeading: ElementType;
  headingClass: string;
}) {
  const t = useTranslations("Offers");
  const { message } = useApiErrorMessages();
  const offers = useRouteOffers(route.id);
  const [dialog, setDialog] = useState<
    | { kind: "offer"; key: number }
    | { kind: "accept" | "withdraw"; key: number; offer: OfferRead }
    | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function open(
    next: { kind: "offer" } | { kind: "accept" | "withdraw"; offer: OfferRead },
  ) {
    setDialog((current) => ({ ...next, key: (current?.key ?? 0) + 1 }));
    setDialogOpen(true);
  }

  const items = useMemo(
    () => offers.data?.pages.flatMap((page) => page.items) ?? [],
    [offers.data],
  );

  // An open offer turns `expired` when its 48 hours pass: reload then, so the page never shows
  // it open (the API says what it is).
  const queryClient = useQueryClient();
  const nextExpiry = items
    .filter((item) => item.status === "open")
    .map((item) => Date.parse(item.expires_at))
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (nextExpiry === undefined) return;
    // Timers cap at about 24.8 days; an offer lasts 48 hours.
    const wait = Math.min(
      Math.max(nextExpiry - Date.now(), 0) + 1000,
      2 ** 31 - 1,
    );
    const timer = setTimeout(
      () =>
        void queryClient.invalidateQueries({
          queryKey: offerKeys.route(route.id),
        }),
      wait,
    );
    return () => clearTimeout(timer);
  }, [nextExpiry, queryClient, route.id]);

  const loadError = offers.isError && !offers.isFetchNextPageError;

  return (
    <section className="grid gap-3">
      <SectionHeading className={headingClass}>{t("title")}</SectionHeading>
      <p className="text-table text-muted">{t("intro")}</p>
      <Button
        variant="secondary"
        className="w-fit"
        onClick={() => open({ kind: "offer" })}
      >
        {t("offer")}
      </Button>

      {offers.isPending ? (
        <div className="grid gap-2" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : loadError && !offers.data ? (
        <ProblemAlert
          message={message(offers.error)}
          requestId={
            offers.error instanceof ApiError ? offers.error.requestId : null
          }
          retryAfterSeconds={
            offers.error instanceof ApiError
              ? offers.error.retryAfterSeconds
              : null
          }
          onRetry={() => void offers.refetch()}
        />
      ) : items.length === 0 ? (
        <p className="text-body text-muted">{t("none")}</p>
      ) : (
        <ul className="grid gap-2" aria-label={t("listLabel")}>
          {items.map((offer) => (
            <OfferItem
              key={offer.id}
              offer={offer}
              onAccept={() => open({ kind: "accept", offer })}
              onWithdraw={() => open({ kind: "withdraw", offer })}
            />
          ))}
        </ul>
      )}
      {/* A reload or the next page failed: what's loaded stays, the error shows beside it. */}
      {offers.data && offers.isError && (
        <ProblemAlert
          message={message(offers.error)}
          requestId={
            offers.error instanceof ApiError ? offers.error.requestId : null
          }
          retryAfterSeconds={
            offers.error instanceof ApiError
              ? offers.error.retryAfterSeconds
              : null
          }
          onRetry={() =>
            void (offers.isFetchNextPageError
              ? offers.fetchNextPage()
              : offers.refetch())
          }
        />
      )}
      {offers.hasNextPage && (
        <Button
          variant="secondary"
          className="w-fit"
          pending={offers.isFetchingNextPage}
          onClick={() => void offers.fetchNextPage()}
        >
          {t("showMore")}
        </Button>
      )}

      {dialog?.kind === "offer" && (
        <OfferDialog
          key={dialog.key}
          route={route}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
      {dialog?.kind === "accept" && (
        <AcceptOfferDialog
          key={dialog.key}
          offer={dialog.offer}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
      {dialog?.kind === "withdraw" && (
        <WithdrawOfferDialog
          key={dialog.key}
          offer={dialog.offer}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </section>
  );
}

/** One offer: who asked (their request), the seat's month, its state and its text message. */
function OfferItem({
  offer,
  onAccept,
  onWithdraw,
}: {
  offer: OfferRead;
  onAccept: () => void;
  onWithdraw: () => void;
}) {
  const t = useTranslations("Offers");
  const { dateTime } = useTimestampFormat();
  const month = useMonthName();
  const link = "font-semibold text-royal underline-offset-4 hover:underline";
  return (
    <li className="grid gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/route-requests/${offer.request_id}`} className={link}>
          {offer.rider_name}
        </Link>
        <StatusPill tone={tones[offer.status]}>
          {offer.status === "open"
            ? t("openUntil", { date: dateTime(offer.expires_at) })
            : t(`status.${offer.status}`)}
        </StatusPill>
      </div>
      <p className="text-table text-ink">
        {t("seatFrom", { month: month(offer.start_date) })}
      </p>
      {offer.sms_status !== null && (
        <p
          className={
            offer.sms_status === "failed"
              ? "text-table font-semibold text-danger"
              : "text-table text-muted"
          }
        >
          {t(`sms.${offer.sms_status}`)}
        </p>
      )}
      {offer.skip_reason !== null && (
        <p className="text-table text-muted">
          {t("skipped", { reason: offer.skip_reason })}
        </p>
      )}
      {offer.status === "accepted" && offer.rider_id !== null && (
        <Link href={`/riders/${offer.rider_id}`} className={`w-fit ${link}`}>
          {t("openRider", { name: offer.rider_name })}
        </Link>
      )}
      {offer.status === "open" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onAccept}>
            {t("accept")}
          </Button>
          <Button variant="secondary" onClick={onWithdraw}>
            {t("withdraw")}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Offer the route's free seat (`offers_create`): to whoever is next in the route's queue
 * (`offers_queue`; the API picks when it's sent), or to a request further back, which needs a
 * reason. Requests that can't be offered a seat are listed last and can't be chosen. On a running
 * route staff choose the 1st it's free from; a forming route's is a reservation from the next 1st.
 * Mount it with a new `key` each time: one Idempotency-Key per opening (a refused attempt changes nothing).
 */
function OfferDialog({
  route,
  open,
  onOpenChange,
}: {
  route: RouteRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Offers");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { message, fieldMessages } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const month = useMonthName();
  const create = useCreateOffer();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [today] = useState(() => todayInAddis());
  const months = startMonths(today);
  const running = route.status === "active";
  const queue = useOfferQueue(route.id, open);
  // Pages are read at different moments: a request the queue moved shows once, where first read.
  const queued = useMemo(() => {
    const seen = new Set<string>();
    const items: OfferQueueItem[] = [];
    for (const page of queue.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.request.id)) continue;
        seen.add(item.request.id);
        items.push(item);
      }
    }
    return items;
  }, [queue.data]);
  const first = queued.find((item) => item.position === 1);
  const ahead = queued.filter(
    (item) => item.position !== null && item !== first,
  );
  const blocked = queued.filter((item) => item.position === null);

  /** null: next in line (the API picks when it's sent). */
  const [requestId, setRequestId] = useState<string | null>(null);
  const [start, setStart] = useState(months[0] ?? "");
  const [reason, setReason] = useState("");
  // Anyone but next in line is offered the seat ahead of the queue: that needs a reason.
  const needsReason = requestId !== null;
  const [errors, setErrors] = useState<{
    request?: string;
    start?: string;
    reason?: string;
  }>({});
  const [problem, setProblem] = useState<unknown>(null);
  // The month a refused offer named (the choice may change after).
  const [sentStart, setSentStart] = useState(months[0] ?? "");
  const retryWait = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const group = useRef<HTMLFieldSetElement>(null);
  const startField = useRef<HTMLSelectElement>(null);
  const reasonField = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const trimmed = reason.trim();
    if (needsReason && !trimmed) {
      setErrors({ reason: t("reasonRequired") });
      reasonField.current?.focus();
      return;
    }
    setErrors({});
    setProblem(null);
    setSentStart(running ? start : (months[0] ?? ""));
    create.mutate(
      {
        routeId: route.id,
        idempotencyKey,
        offer: {
          ...(requestId ? { request_id: requestId } : {}),
          ...(needsReason ? { skip_reason: trimmed } : {}),
          ...(running ? { start_date: start } : {}),
        },
      },
      {
        onSuccess: () => {
          showSuccessToast(t("offeredToast"));
          onOpenChange(false);
        },
        onError: (error) => {
          const fields = fieldMessages(error);
          if (fields.skip_reason) {
            setErrors({ reason: t("reasonInvalid") });
            reasonField.current?.focus();
            return;
          }
          if (fields.request_id) {
            // The queue has changed: show it again.
            void queue.refetch();
            setErrors({ request: t("requestRefused") });
            group.current
              ?.querySelector<HTMLInputElement>("input:checked")
              ?.focus();
            return;
          }
          if (fields.start_date) {
            setErrors({ start: t("startRefused") });
            startField.current?.focus();
            return;
          }
          setProblem(error);
        },
      },
    );
  }

  let problemWords = problem !== null ? message(problem) : "";
  if (problem instanceof ApiError) {
    if (problem.code === "ROUTE_FULL") {
      problemWords = t(running ? "fullRunning" : "fullForming", {
        month: month(sentStart),
      });
    } else if (problem.code === "NO_WAITING_REQUESTS") {
      problemWords = t("nobodyWaiting");
    } else if (problem.code === "OFFER_OPEN") {
      problemWords = t("alreadyOffered");
    } else if (problem.code === "ROUTE_NOT_READY") {
      problemWords = t("routeNotReady");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending && !next) return;
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
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("offerTitle", { code: route.code })}</DialogTitle>
          <DialogDescription>{t("offerHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={submit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={problemWords}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}

          <fieldset ref={group} className="grid gap-2">
            <legend className="mb-1 text-table font-semibold text-ink">
              {t("toLegend")}
            </legend>
            <Choice
              name={`${uid}-request`}
              checked={requestId === null}
              onChoose={() => {
                setRequestId(null);
                setErrors({});
              }}
              label={t("nextInLine")}
              detail={
                !queue.data
                  ? t("nextInLineHint")
                  : first
                    ? [
                        t("nextInLineIs", {
                          name: first.request.rider_name,
                          date: date(first.request.created_at),
                        }),
                        ...(first.offered_before ? [t("offeredBefore")] : []),
                      ].join(" · ")
                    : t("nextInLineNobody")
              }
              strong
            />
            {queue.isPending ? (
              <Skeleton className="h-12" />
            ) : !queue.data ? (
              <QueueProblem error={queue.error} onRetry={queue.refetch} />
            ) : queued.length === 0 ? (
              <p className="text-table text-muted">{t("waitingNone")}</p>
            ) : (
              <>
                {ahead.length > 0 && (
                  <p className="mt-2 text-table text-muted">{t("orChoose")}</p>
                )}
                {ahead.map((item) => (
                  <Choice
                    key={item.request.id}
                    name={`${uid}-request`}
                    checked={requestId === item.request.id}
                    onChoose={() => {
                      setRequestId(item.request.id);
                      setErrors({});
                    }}
                    label={t("position", {
                      position: item.position ?? 0,
                      name: item.request.rider_name,
                    })}
                    detail={[
                      t("askedOn", { date: date(item.request.created_at) }),
                      ...(item.offered_before ? [t("offeredBefore")] : []),
                    ].join(" · ")}
                    describedBy={errors.request ? `${uid}-to-error` : undefined}
                  />
                ))}
                {blocked.length > 0 && (
                  <p className="mt-2 text-table text-muted">{t("cantOffer")}</p>
                )}
                {blocked.map((item) => (
                  <Choice
                    key={item.request.id}
                    name={`${uid}-request`}
                    checked={false}
                    disabled
                    onChoose={() => {}}
                    label={item.request.rider_name}
                    detail={[
                      t("askedOn", { date: date(item.request.created_at) }),
                      ...(item.not_offerable
                        ? [t(`notOfferable.${item.not_offerable}`)]
                        : []),
                    ].join(" · ")}
                  />
                ))}
              </>
            )}
            {/* The next page or a reload failed: the queue loaded so far stays. */}
            {queue.data && queue.isError && (
              <QueueProblem
                error={queue.error}
                onRetry={
                  queue.isFetchNextPageError
                    ? queue.fetchNextPage
                    : queue.refetch
                }
              />
            )}
            {queue.hasNextPage && (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                pending={queue.isFetchingNextPage}
                onClick={() => void queue.fetchNextPage()}
              >
                {t("showMoreQueue")}
              </Button>
            )}
            {errors.request && (
              <p id={`${uid}-to-error`} className="text-table text-danger">
                {errors.request}
              </p>
            )}
          </fieldset>

          {running ? (
            <div className="grid gap-1.5 sm:max-w-xs">
              <Label htmlFor={`${uid}-start`}>{t("startLabel")}</Label>
              <select
                id={`${uid}-start`}
                ref={startField}
                className={selectClass}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-invalid={errors.start ? true : undefined}
                aria-describedby={`${uid}-start-hint${
                  errors.start ? ` ${uid}-start-error` : ""
                }`}
              >
                {months.map((value) => (
                  <option key={value} value={value}>
                    {month(value)}
                  </option>
                ))}
              </select>
              <p id={`${uid}-start-hint`} className="text-table text-muted">
                {t("startHint")}
              </p>
              {errors.start && (
                <p id={`${uid}-start-error`} className="text-table text-danger">
                  {errors.start}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-ice px-4 py-3 text-table text-navy">
              {t("formingNote", { month: month(months[0] ?? "") })}
            </p>
          )}

          {needsReason && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${uid}-reason`}>{t("reasonLabel")}</Label>
              <Input
                id={`${uid}-reason`}
                ref={reasonField}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={errors.reason ? true : undefined}
                aria-describedby={`${uid}-reason-hint${
                  errors.reason ? ` ${uid}-reason-error` : ""
                }`}
              />
              <p id={`${uid}-reason-hint`} className="text-table text-muted">
                {t("reasonHint")}
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
                aria-disabled={create.isPending || undefined}
              >
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={create.isPending}
              aria-disabled={retryWait || undefined}
            >
              {t("offerSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One radio choice in a card: its name, and a detail line read as its description. */
function Choice({
  name,
  checked,
  onChoose,
  label,
  detail,
  strong,
  disabled,
  describedBy,
}: {
  name: string;
  checked: boolean;
  onChoose: () => void;
  label: string;
  detail: string;
  strong?: boolean;
  /** Listed, with why in `detail`, but can't be chosen. */
  disabled?: boolean;
  describedBy?: string;
}) {
  const uid = useId();
  return (
    <div
      className={
        disabled
          ? "grid gap-0.5 rounded-lg border border-line bg-canvas p-3"
          : "grid gap-0.5 rounded-lg border border-line p-3 has-[:checked]:border-royal has-[:checked]:bg-ice"
      }
    >
      <label
        className={
          disabled
            ? "flex cursor-not-allowed items-center gap-3"
            : "flex cursor-pointer items-center gap-3"
        }
      >
        <input
          type="radio"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChoose}
          aria-describedby={[`${uid}-detail`, describedBy]
            .filter(Boolean)
            .join(" ")}
          className="size-4 shrink-0 accent-royal"
        />
        <span className={strong ? "font-semibold text-ink" : "text-ink"}>
          {label}
        </span>
      </label>
      <p id={`${uid}-detail`} className="pl-7 text-table text-muted">
        {detail}
      </p>
    </div>
  );
}

/** The queue didn't load (or its next page): why, with a retry. */
function QueueProblem({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => unknown;
}) {
  const { message } = useApiErrorMessages();
  return (
    <ProblemAlert
      message={message(error)}
      requestId={error instanceof ApiError ? error.requestId : null}
      retryAfterSeconds={
        error instanceof ApiError ? error.retryAfterSeconds : null
      }
      onRetry={() => void onRetry()}
    />
  );
}

/** Accept for someone who said yes on the phone (`offers_accept`). */
function AcceptOfferDialog({
  offer,
  open,
  onClose,
}: {
  offer: OfferRead;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Offers");
  const { message } = useApiErrorMessages();
  const month = useMonthName();
  const accept = useAcceptOffer();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const error = accept.error;
  const waiting = useRetryWait(error);
  const code = error instanceof ApiError ? error.code : null;
  const final = code === "OFFER_CLOSED";
  const words: Record<string, string> = {
    OFFER_CLOSED: t("closed"),
    RIDER_HAS_SEAT: t("riderHasSeat", { code: offer.route_code }),
    RIDER_EXISTS: t("riderExists"),
    ROUTE_FULL: t("acceptFull"),
  };
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        accept.reset();
        onClose();
      }}
      title={t("acceptTitle", { name: offer.rider_name })}
      description={t("acceptDescription", {
        code: offer.route_code,
        month: month(offer.start_date),
      })}
      confirmLabel={t("accept")}
      pending={accept.isPending}
      confirmDisabled={waiting || final}
      onConfirm={() =>
        accept.mutate(
          { offerId: offer.id, idempotencyKey },
          {
            onSuccess: () => {
              showSuccessToast(t("acceptedToast"));
              onClose();
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={(code && words[code]) || message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}

/** The person said no, or it was a mistake (`offers_withdraw`): the seat is free again. */
function WithdrawOfferDialog({
  offer,
  open,
  onClose,
}: {
  offer: OfferRead;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Offers");
  const { message } = useApiErrorMessages();
  const withdraw = useWithdrawOffer();
  const error = withdraw.error;
  const waiting = useRetryWait(error);
  const closed = error instanceof ApiError && error.code === "OFFER_CLOSED";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        withdraw.reset();
        onClose();
      }}
      title={t("withdrawTitle", { name: offer.rider_name })}
      description={t("withdrawDescription", { code: offer.route_code })}
      confirmLabel={t("withdraw")}
      tone="destructive"
      pending={withdraw.isPending}
      confirmDisabled={waiting || closed}
      onConfirm={() =>
        withdraw.mutate(offer.id, {
          onSuccess: () => {
            showSuccessToast(t("withdrawnToast"));
            onClose();
          },
        })
      }
    >
      {error && (
        <ProblemAlert
          message={closed ? t("closed") : message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
