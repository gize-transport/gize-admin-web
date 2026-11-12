"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ElementType } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useTimestampFormat } from "@/lib/time";
import { useLaunchMessages, useRetryLaunchMessages } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type LaunchMessage = components["schemas"]["LaunchMessage"];
type LaunchMessageStatus = components["schemas"]["LaunchMessageStatus"];

/** After a launch or a resend, how long texts still to go are watched. */
const WATCH_MS = 60_000;

const tones: Record<LaunchMessageStatus, StatusTone> = {
  sent: "success",
  sending: "waiting",
  unconfirmed: "waiting",
  failed: "danger",
  pending: "neutral",
};

/** The counts in the summary, in this order (none shown when 0). */
const COUNTED = [
  "sent",
  "sending",
  "unconfirmed",
  "failed",
  "pending",
] as const satisfies readonly LaunchMessageStatus[];

/**
 * The texts a launched route sent its riders (GZW-025): when it launched, how each went (no phone
 * numbers: each name opens the rider), and "Send again" for those not delivered or not sent yet.
 * Public and student routes, once launched (running or paused); company routes send none.
 */
export function LaunchMessages({
  route,
  SectionHeading,
  headingClass,
}: {
  route: RouteRead;
  SectionHeading: ElementType;
  headingClass: string;
}) {
  const launched =
    route.route_type !== "corporate" &&
    (route.status === "active" || route.status === "paused");
  if (!launched) return null;
  return (
    <LaunchSection
      route={route}
      SectionHeading={SectionHeading}
      headingClass={headingClass}
    />
  );
}

function LaunchSection({
  route,
  SectionHeading,
  headingClass,
}: {
  route: RouteRead;
  SectionHeading: ElementType;
  headingClass: string;
}) {
  const t = useTranslations("LaunchMessages");
  const { message } = useApiErrorMessages();
  const { day } = useTimestampFormat();
  // A launch is the route's latest change just after it: its texts are watched for a minute,
  // as they are after a resend.
  const [resentAt, setResentAt] = useState(0);
  const watchUntil =
    Math.max(Date.parse(route.updated_at) || 0, resentAt) + WATCH_MS;
  const messages = useLaunchMessages(route.id, { enabled: true, watchUntil });
  const [dialog, setDialog] = useState<{ key: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const data = messages.data;
  const toSend = data ? data.failed + data.pending : 0;

  return (
    <section className="grid gap-3">
      <SectionHeading className={headingClass}>{t("title")}</SectionHeading>
      <p className="text-table text-muted">{t("intro")}</p>

      {messages.isPending ? (
        <div className="grid gap-2" aria-busy="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-14" />
        </div>
      ) : !data ? (
        <ProblemAlert
          message={message(messages.error)}
          requestId={
            messages.error instanceof ApiError ? messages.error.requestId : null
          }
          retryAfterSeconds={
            messages.error instanceof ApiError
              ? messages.error.retryAfterSeconds
              : null
          }
          onRetry={() => void messages.refetch()}
        />
      ) : data.total === 0 ? (
        <p className="text-body text-muted">{t("none")}</p>
      ) : (
        <>
          <p className="text-body font-semibold text-ink">
            {[
              ...(data.launch_date
                ? [t("launchedFor", { date: day(data.launch_date) })]
                : []),
              t("riders", { count: data.total }),
              ...COUNTED.filter((status) => data[status] > 0).map((status) =>
                t(`counts.${status}`, { count: data[status] }),
              ),
            ].join(" · ")}
          </p>
          <ul className="grid gap-2" aria-label={t("listLabel")}>
            {data.riders.map((rider) => (
              <MessageItem key={rider.rider_id} rider={rider} />
            ))}
          </ul>
          {toSend > 0 && (
            <Button
              variant="secondary"
              className="w-fit"
              onClick={() => {
                setDialog((current) => ({ key: (current?.key ?? 0) + 1 }));
                setDialogOpen(true);
              }}
            >
              {t("retry", { count: toSend })}
            </Button>
          )}
        </>
      )}
      {/* A reload failed: what's loaded stays, the error shows beside it. */}
      {data && messages.isError && (
        <ProblemAlert
          message={message(messages.error)}
          requestId={
            messages.error instanceof ApiError ? messages.error.requestId : null
          }
          retryAfterSeconds={
            messages.error instanceof ApiError
              ? messages.error.retryAfterSeconds
              : null
          }
          onRetry={() => void messages.refetch()}
        />
      )}

      {dialog && (
        <ResendDialog
          key={dialog.key}
          routeId={route.id}
          count={toSend}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onResent={() => setResentAt(Date.now())}
        />
      )}
    </section>
  );
}

/** One rider's text: who (their page), their first day, and how it went. */
function MessageItem({ rider }: { rider: LaunchMessage }) {
  const t = useTranslations("LaunchMessages");
  const { day } = useTimestampFormat();
  return (
    <li className="grid gap-1 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/riders/${rider.rider_id}`}
          className="font-semibold text-royal underline-offset-4 hover:underline"
        >
          {rider.full_name}
        </Link>
        <StatusPill tone={tones[rider.status]}>
          {t(`status.${rider.status}`)}
        </StatusPill>
      </div>
      <p className="text-table text-ink">
        {[
          t("firstDay", { date: day(rider.start_date) }),
          ...(rider.attempts > 1
            ? [t("attempts", { count: rider.attempts })]
            : []),
        ].join(" · ")}
      </p>
      {rider.status === "unconfirmed" && (
        <p className="text-table text-muted">{t("unconfirmedHint")}</p>
      )}
    </li>
  );
}

/**
 * Confirm sending the launch text again to those not delivered or not sent yet. Mount it with a
 * new `key` each time: one Idempotency-Key per opening, reused when the same one is sent again.
 */
function ResendDialog({
  routeId,
  count,
  open,
  onClose,
  onResent,
}: {
  routeId: string;
  count: number;
  open: boolean;
  onClose: () => void;
  onResent: () => void;
}) {
  const t = useTranslations("LaunchMessages");
  const { message } = useApiErrorMessages();
  const resend = useRetryLaunchMessages();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // The count as it was when the dialog opened: the list may reload meanwhile.
  const [shown] = useState(count);
  const error = resend.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        resend.reset();
        onClose();
      }}
      title={t("retryTitle")}
      description={t("retryDescription", { count: shown })}
      confirmLabel={t("retryConfirm")}
      pending={resend.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        resend.mutate(
          { routeId, idempotencyKey },
          {
            onSuccess: () => {
              onResent();
              showSuccessToast(t("retriedToast"));
              onClose();
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
