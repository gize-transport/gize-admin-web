"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { RoutePicker } from "@/components/pickers/route-picker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { refetchRequest, routeSearch, useSetRequestStatus } from "./queries";

type RouteRequestRead = components["schemas"]["RouteRequestRead"];
type RouteRef = components["schemas"]["RouteRef"];
type Action = "match" | "fulfil" | "decline";

// The contract's limit (RouteRequestStatusSet.decline_reason).
const REASON_MAX = 100;

/**
 * What can happen next to a request (GZW-040): from the documented flow – `new` → `matched`
 * (again, to another route) → `fulfilled`, `new` → `fulfilled`, open → `declined`; fulfilled and
 * declined are final (owner decision 2026-11-03: requests have no `status_changes`). The API
 * still decides: a refusal is explained and the request reloads.
 */
export function RequestActions({ request }: { request: RouteRequestRead }) {
  const t = useTranslations("RouteRequests");
  // The action as it was when its button was pressed (and the request then): a successful move
  // changes the request, and the open dialog must stay the one it was.
  const [open, setOpen] = useState<{
    action: Action;
    request: RouteRequestRead;
    key: number;
  } | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  // After a move the buttons change (the one pressed may be gone): focus goes to this section.
  // So it does after a refusal that reloaded the request without its button, rather than
  // falling to the page. After the closing dialog's own focus return, which Radix runs in a
  // timeout as it unmounts.
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

  const start = (action: Action) =>
    setOpen((previous) => ({
      action,
      request,
      key: (previous?.key ?? 0) + 1,
    }));
  const onClose = (moved: boolean) => {
    focusAfterClose.current = moved ? "moved" : "refused";
    setOpen(null);
  };
  const isOpen = request.status === "new" || request.status === "matched";

  return (
    <div
      ref={groupRef}
      tabIndex={-1}
      role="group"
      aria-label={t("nextSteps")}
      className="grid gap-3 rounded-lg outline-none"
    >
      {isOpen ? (
        <>
          <p className="text-body text-muted">
            {request.status === "matched" && request.matched_route
              ? t("nextStepsMatched", { code: request.matched_route.code })
              : t("nextStepsNew")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={request.status === "new" ? "primary" : "secondary"}
              onClick={() => start("match")}
            >
              {t(request.status === "matched" ? "rematch" : "match")}
            </Button>
            <Button
              variant={request.status === "matched" ? "primary" : "secondary"}
              onClick={() => start("fulfil")}
            >
              {t("fulfil")}
            </Button>
            <Button variant="secondary" onClick={() => start("decline")}>
              {t("decline")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-body text-muted">
          {t(
            request.status === "fulfilled"
              ? "closedFulfilled"
              : "closedDeclined",
          )}
        </p>
      )}

      {open?.action === "match" && (
        <MatchDialog key={open.key} request={open.request} onClose={onClose} />
      )}
      {open?.action === "fulfil" && (
        <FulfilDialog key={open.key} request={open.request} onClose={onClose} />
      )}
      {open?.action === "decline" && (
        <DeclineDialog
          key={open.key}
          request={open.request}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** A refusal's words: a move no longer possible (the request reloaded), else the usual. */
function useRefusalMessage() {
  const t = useTranslations("RouteRequests");
  const { message } = useApiErrorMessages();
  return (error: unknown) =>
    error instanceof ApiError && error.code === "INVALID_STATUS_CHANGE"
      ? t("statusChangeInvalid")
      : message(error);
}

/** On close after a 404 (deleted meanwhile): the detail reloads and shows that. */
function useCloseRefetch(request: RouteRequestRead) {
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      refetchRequest(queryClient, request.id);
    }
  };
}

function ProblemFor({ error }: { error: unknown }) {
  const refusal = useRefusalMessage();
  return (
    <ProblemAlert
      message={refusal(error)}
      requestId={error instanceof ApiError ? error.requestId : null}
      retryAfterSeconds={
        error instanceof ApiError ? error.retryAfterSeconds : null
      }
    />
  );
}

/** Match to a route: one for this rider (the picker offers public or student routes). */
function MatchDialog({
  request,
  onClose,
}: {
  request: RouteRequestRead;
  onClose: (moved: boolean) => void;
}) {
  const t = useTranslations("RouteRequests");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const setStatus = useSetRequestStatus();
  const closeRefetch = useCloseRefetch(request);
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const routeType = request.rider_type === "adult" ? "public" : "student";
  const search = useMemo(() => routeSearch(routeType), [routeType]);
  const schema = useMemo(
    () =>
      z.object({
        route: z
          .custom<RouteRef>(
            (value) => typeof value === "object" && value !== null,
          )
          .nullable()
          .refine((value) => value !== null, t("matchRouteRequired")),
      }),
    [t],
  );
  const {
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { route: null },
  });
  const pending = setStatus.isPending;

  const onSubmit = handleSubmit(async ({ route }) => {
    if (!route) return;
    setProblem(null);
    try {
      const saved = await setStatus.mutateAsync({
        id: request.id,
        change: { status: "matched", matched_route_id: route.id },
      });
      showSuccessToast(
        t("matched", { code: saved.matched_route?.code ?? route.code }),
      );
      onClose(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.fieldErrors.some(
          (fieldError) => fieldError.path === "matched_route_id",
        )
      ) {
        setError("route", { message: t("matchRouteNotFor") });
        setFocus("route");
        return;
      }
      setProblem(error);
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (next || pending) return;
        closeRefetch(problem);
        onClose(false);
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
          <DialogTitle>{t("matchTitle")}</DialogTitle>
          <DialogDescription>{t("matchDescription")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && <ProblemFor error={problem} />}
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-match-route`}>{t("matchRouteLabel")}</Label>
            <Controller
              control={control}
              name="route"
              render={({ field }) => (
                <RoutePicker
                  id={`${uid}-match-route`}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  search={search}
                  scope={`match-${routeType}`}
                  invalid={Boolean(errors.route)}
                  aria-describedby={
                    errors.route ? `${uid}-match-route-error` : undefined
                  }
                />
              )}
            />
            {errors.route && (
              <p
                id={`${uid}-match-route-error`}
                className="text-table text-danger"
              >
                {errors.route.message}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" aria-disabled={pending || undefined}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={pending}
              aria-disabled={waiting || undefined}
            >
              {t("matchSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Mark fulfilled: confirmed, it's final. */
function FulfilDialog({
  request,
  onClose,
}: {
  request: RouteRequestRead;
  onClose: (moved: boolean) => void;
}) {
  const t = useTranslations("RouteRequests");
  const setStatus = useSetRequestStatus();
  const closeRefetch = useCloseRefetch(request);
  const error = setStatus.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (next) return;
        closeRefetch(error);
        onClose(false);
      }}
      title={t("fulfilTitle")}
      description={t("fulfilDescription")}
      confirmLabel={t("fulfil")}
      pending={setStatus.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        setStatus.mutate(
          { id: request.id, change: { status: "fulfilled" } },
          {
            onSuccess: () => {
              showSuccessToast(t("fulfilled"));
              onClose(true);
            },
          },
        )
      }
    >
      {error && <ProblemFor error={error} />}
    </ConfirmDialog>
  );
}

/** Decline with a reason (1–100 characters): final. */
function DeclineDialog({
  request,
  onClose,
}: {
  request: RouteRequestRead;
  onClose: (moved: boolean) => void;
}) {
  const t = useTranslations("RouteRequests");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { fieldMessages } = useApiErrorMessages();
  const setStatus = useSetRequestStatus();
  const closeRefetch = useCloseRefetch(request);
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        reason: z
          .string()
          .trim()
          .min(1, t("declineReasonRequired"))
          .max(REASON_MAX, t("declineReasonTooLong")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });
  const pending = setStatus.isPending;

  const onSubmit = handleSubmit(async ({ reason }) => {
    setProblem(null);
    try {
      await setStatus.mutateAsync({
        id: request.id,
        change: { status: "declined", decline_reason: reason },
      });
      showSuccessToast(t("declined"));
      onClose(true);
    } catch (error) {
      const onField = fieldMessages(error).decline_reason;
      if (onField) {
        setError("reason", { message: onField });
        setFocus("reason");
        return;
      }
      setProblem(error);
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (next || pending) return;
        closeRefetch(problem);
        onClose(false);
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
          <DialogTitle>{t("declineTitle")}</DialogTitle>
          <DialogDescription>{t("declineDescription")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && <ProblemFor error={problem} />}
          <FormField
            id={`${uid}-decline-reason`}
            label={t("declineReasonLabel")}
            hint={t("declineReasonHint")}
            error={errors.reason}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={REASON_MAX}
                autoComplete="off"
                {...register("reason")}
              />
            )}
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" aria-disabled={pending || undefined}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              pending={pending}
              aria-disabled={waiting || undefined}
            >
              {t("decline")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
