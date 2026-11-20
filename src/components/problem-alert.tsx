"use client";

import { CircleAlertIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** How early a countdown tick may come and still count as on time (see the countdown below). */
const EARLY_TICK_MS = 50;

type ProblemAlertProps = {
  /** Friendly message for the problem's `code` (from lib/api/errors.ts). */
  message: string;
  title?: string;
  /** `request_id` from the problem, shown so staff can quote it to support. */
  requestId?: string | null;
  /** From `Retry-After` on a 429: retry stays disabled until the countdown ends. */
  retryAfterSeconds?: number | null;
  onRetry?: () => void;
};

type CopyState = "idle" | "copied" | "failed";

export function ProblemAlert({
  message,
  title,
  requestId,
  retryAfterSeconds,
  onRetry,
}: ProblemAlertProps) {
  const t = useTranslations("ProblemAlert");
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds ?? 0);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  // Each new problem (new request ID or Retry-After) restarts the countdown and the copy state,
  // even when the same alert stays on screen between retries.
  const problemKey = `${requestId ?? ""}|${retryAfterSeconds ?? ""}`;
  const [shownProblem, setShownProblem] = useState(problemKey);
  if (shownProblem !== problemKey) {
    setShownProblem(problemKey);
    setSecondsLeft(retryAfterSeconds ?? 0);
    setCopyState("idle");
  }

  useEffect(() => {
    if (!retryAfterSeconds) return;
    // Counts against a deadline, so throttled timers in background tabs can't stretch the wait.
    const deadline = Date.now() + retryAfterSeconds * 1000;
    const timer = setInterval(() => {
      // A timer can fire a few milliseconds before the clock reaches its time: count that as
      // done, or the last second would show (and keep Retry disabled) for a whole extra tick,
      // after the caller's own wait (useRetryWait) has already ended.
      const left = Math.max(
        0,
        Math.ceil((deadline - Date.now() - EARLY_TICK_MS) / 1000),
      );
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [problemKey, retryAfterSeconds]);

  async function copyReference() {
    if (!requestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const rateLimited = retryAfterSeconds != null;
  const waiting = secondsLeft > 0;

  return (
    // Only the title and message are announced assertively; everything that changes later has its
    // own polite status, so screen readers don't re-read the whole alert.
    <Alert variant="destructive" role={undefined}>
      <CircleAlertIcon aria-hidden />
      <div role="alert" className="col-start-2 grid gap-1">
        <p className="font-semibold">{title ?? t("title")}</p>
        <p>{message}</p>
      </div>
      <AlertDescription>
        {rateLimited && (
          <>
            {/* Visible countdown; screen readers hear the start and the end only. */}
            <p aria-hidden>
              {waiting
                ? t("rateLimited", { seconds: secondsLeft })
                : t("rateLimitOver")}
            </p>
            <p role="status" className="sr-only">
              {waiting
                ? t("rateLimited", { seconds: retryAfterSeconds })
                : t("rateLimitOver")}
            </p>
          </>
        )}
        {requestId && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
            <span>
              {t("reference")}{" "}
              <span className="font-mono text-ink select-all">{requestId}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={copyReference}
            >
              <CopyIcon aria-hidden />
              {t("copy")}
            </Button>
            <span role="status" className="text-ink">
              {copyState === "copied" && t("copied")}
              {copyState === "failed" && t("copyFailed")}
            </span>
          </div>
        )}
        {onRetry && (
          <div className="mt-1">
            <Button
              variant="secondary"
              size="sm"
              aria-disabled={waiting || undefined}
              onClick={onRetry}
            >
              {t("retry")}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
