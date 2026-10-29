"use client";

import { CircleAlertIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ProblemAlertProps = {
  /** Friendly message for the problem's `code` (from lib/api/errors.ts). */
  message: string;
  title?: string;
  /** `request_id` from the problem, shown so staff can quote it to support. */
  requestId?: string | null;
  /** From `Retry-After` on a 429: retry stays disabled until the countdown ends. */
  retryAfterSeconds?: number;
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

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function copyReference() {
    if (!requestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const rateLimited = retryAfterSeconds !== undefined;

  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{title ?? t("title")}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {rateLimited && (
          <p>
            {secondsLeft > 0
              ? t("rateLimited", { seconds: secondsLeft })
              : t("rateLimitOver")}
          </p>
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
              aria-disabled={secondsLeft > 0 || undefined}
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
