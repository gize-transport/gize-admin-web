"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { DriverPicker } from "@/components/pickers/driver-picker";
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
import type { DriverOption } from "@/features/drivers/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { refetchRoute, useSetRouteDriver } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];

/**
 * Who drives the route (GZW-053): their name (their page) and plate, or none yet; staff choose,
 * change or remove them. Only active drivers are offered; the API decides whether their times
 * clash with another of their routes (`DRIVER_BUSY`).
 */
export function RouteDriver({ route }: { route: RouteRead }) {
  const t = useTranslations("Routes");
  // The driver's name as when Remove was pressed: the dialog stays (and finishes: its toast)
  // after the route comes back without them.
  const [dialog, setDialog] = useState<{
    kind: "choose" | "remove";
    key: number;
    driverName: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // After a removal, "Remove driver" is gone: the closing dialog sends focus to "Choose driver".
  const chooseButton = useRef<HTMLButtonElement>(null);

  function open(kind: "choose" | "remove") {
    setDialog((current) => ({
      kind,
      key: (current?.key ?? 0) + 1,
      driverName: route.driver?.full_name ?? "",
    }));
    setDialogOpen(true);
  }

  return (
    <span className="grid gap-2">
      {route.driver ? (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/drivers/${route.driver.id}`}
            className="font-semibold text-royal underline-offset-4 hover:underline"
          >
            {route.driver.full_name}
          </Link>
          <span className="font-mono text-table text-muted">
            {route.driver.plate}
          </span>
        </span>
      ) : (
        <span className="text-muted">{t("driverNone")}</span>
      )}
      <span className="flex flex-wrap gap-2">
        <Button
          ref={chooseButton}
          variant="secondary"
          size="sm"
          onClick={() => open("choose")}
        >
          {route.driver ? t("changeDriver") : t("chooseDriver")}
        </Button>
        {route.driver && (
          <Button variant="secondary" size="sm" onClick={() => open("remove")}>
            {t("removeDriver")}
          </Button>
        )}
      </span>

      {dialog?.kind === "choose" && (
        <ChooseDriverDialog
          key={dialog.key}
          route={route}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
      {dialog?.kind === "remove" && (
        <RemoveDriverDialog
          key={dialog.key}
          route={route}
          driverName={dialog.driverName}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          chooseButton={chooseButton}
        />
      )}
    </span>
  );
}

/** Choose the route's driver from the active ones (`routes_set_driver`). */
function ChooseDriverDialog({
  route,
  open,
  onOpenChange,
}: {
  route: RouteRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Routes");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const setDriver = useSetRouteDriver();
  const [chosen, setChosen] = useState<DriverOption | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const picker = useRef<HTMLButtonElement>(null);
  // Focus moves to the picker after the render that shows its error, so it's read with it.
  const [focusPicker, setFocusPicker] = useState(0);
  useEffect(() => {
    if (focusPicker > 0) picker.current?.focus();
  }, [focusPicker]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (setDriver.isPending || waiting) return;
    if (!chosen) {
      setFieldError(t("driverRequired"));
      setFocusPicker((count) => count + 1);
      return;
    }
    setFieldError(null);
    setProblem(null);
    setDriver.mutate(
      { id: route.id, driverId: chosen.id },
      {
        onSuccess: () => {
          showSuccessToast(t("driverSavedToast"));
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "DRIVER_BUSY") {
            setFieldError(t("driverBusy", { name: chosen.fullName }));
            setFocusPicker((count) => count + 1);
            return;
          }
          if (
            error instanceof ApiError &&
            error.status === 422 &&
            error.fieldErrors.some((field) => field.path === "driver_id")
          ) {
            // Deactivated or deleted meanwhile: choose again (the picker searches afresh).
            setChosen(null);
            setFieldError(t("driverUnavailable"));
            setFocusPicker((count) => count + 1);
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
        if (setDriver.isPending && !next) return;
        // Deleted meanwhile: its detail shows that once the dialog closes.
        if (!next && problem instanceof ApiError && problem.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        onOpenChange(next);
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
          <DialogTitle>{t("driverTitle", { code: route.code })}</DialogTitle>
          <DialogDescription>{t("driverHint")}</DialogDescription>
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
          <FormField
            id={`${uid}-driver`}
            label={t("driverLabel")}
            error={
              fieldError ? { type: "api", message: fieldError } : undefined
            }
          >
            {(aria) => (
              <DriverPicker
                id={aria.id}
                ref={picker}
                value={chosen}
                onChange={(next) => {
                  setChosen(next);
                  setFieldError(null);
                }}
                invalid={aria["aria-invalid"]}
                aria-describedby={aria["aria-describedby"]}
              />
            )}
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="secondary"
                aria-disabled={setDriver.isPending || undefined}
              >
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={setDriver.isPending}
              aria-disabled={waiting || undefined}
            >
              {t("driverSave")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Take the driver off the route (`routes_set_driver` with none). */
function RemoveDriverDialog({
  route,
  driverName,
  open,
  onClose,
  chooseButton,
}: {
  route: RouteRead;
  /** As when the dialog opened: the route has no driver once it succeeds. */
  driverName: string;
  open: boolean;
  onClose: () => void;
  /** Where focus goes once the driver is removed (their Remove button is gone). */
  chooseButton: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("Routes");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const setDriver = useSetRouteDriver();
  const error = setDriver.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        setDriver.reset();
        onClose();
      }}
      title={t("removeDriverTitle", { name: driverName, code: route.code })}
      description={t("removeDriverDescription")}
      confirmLabel={t("removeDriver")}
      focusOnClose={() => (setDriver.isSuccess ? chooseButton.current : null)}
      pending={setDriver.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        setDriver.mutate(
          { id: route.id, driverId: null },
          {
            onSuccess: () => {
              showSuccessToast(t("driverRemovedToast"));
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
