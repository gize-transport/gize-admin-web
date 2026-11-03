"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/form-field";
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
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { companyKeys } from "@/features/companies/queries";
import { refetchRoute, useCopyRoute } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type RouteCopy = components["schemas"]["RouteCopy"];

// The contract's limits (RouteCopy).
const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,18}[A-Za-z0-9]$/;
const CODE_MAX = 20;
const SEATS_MAX = 60;

const allFields = ["code", "seats", "launch_minimum"] as const;

function wholeNumber(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}

type RouteVanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The route the van copies. */
  route: RouteRead;
  /** The new route, once added: the caller opens it. */
  onAdded: (van: RouteRead) => void;
};

/**
 * Add a van (GZW-028): a new route like this one, for when it's full. It gets its own code and
 * seats (and launch minimum, individual routes); the API copies the rest. Mount it with a new
 * `key` each time it opens: every add has its own Idempotency-Key, kept for its retries.
 */
export function RouteVanDialog({
  open,
  onOpenChange,
  route: routeProp,
  onAdded,
}: RouteVanDialogProps) {
  const t = useTranslations("Routes");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const copy = useCopyRoute();
  // The route as the dialog opened with it.
  const [route] = useState(routeProp);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = copy.isPending;
  // Added: the new van opens and takes focus itself; the dialog doesn't hand focus back.
  const [addedVan, setAddedVan] = useState(false);
  // After a 429, the button stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  const corporate = route.route_type === "corporate";

  const schema = useMemo(
    () =>
      z
        .object({
          code: z.string().trim(),
          seats: z.string().trim(),
          launch_minimum: z.string().trim(),
        })
        .superRefine((values, ctx) => {
          const issue = (path: string, text: string) =>
            ctx.addIssue({ code: "custom", path: [path], message: text });
          if (!CODE.test(values.code)) issue("code", t("codeInvalid"));
          const seats = wholeNumber(values.seats);
          if (seats === null || seats < 1 || seats > SEATS_MAX) {
            issue("seats", t("seatsInvalid"));
          }
          if (!corporate) {
            const minimum = wholeNumber(values.launch_minimum);
            if (minimum === null || minimum < 1 || minimum > SEATS_MAX) {
              issue("launch_minimum", t("launchMinimumInvalid"));
            } else if (seats !== null && minimum > seats) {
              issue("launch_minimum", t("launchMinimumAboveSeats"));
            }
          }
        }),
    [t, corporate],
  );
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      seats: String(route.seats),
      launch_minimum:
        route.launch_minimum === null ? "" : String(route.launch_minimum),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    const van: RouteCopy = {
      code: values.code.toUpperCase(),
      seats: Number(values.seats),
    };
    if (!corporate) van.launch_minimum = Number(values.launch_minimum);
    try {
      const added = await copy.mutateAsync({
        id: route.id,
        van,
        idempotencyKey,
      });
      showSuccessToast(
        t("vanAdded", {
          code: added.code,
          start: t(
            added.status === "forming" ? "vanStartsForming" : "vanStartsDraft",
          ),
        }),
      );
      setAddedVan(true);
      onOpenChange(false);
      onAdded(added);
    } catch (error) {
      if (error instanceof ApiError && error.code === "ROUTE_CODE_TAKEN") {
        setError("code", { message: t("codeTaken") });
        setFocus("code");
        return;
      }
      const onFields = fieldMessages(error);
      // Only fields shown here (a corporate route has no launch minimum): anything else is an
      // alert, so a refusal can't vanish onto a field that isn't there.
      const fields = allFields.filter(
        (field) => !(corporate && field === "launch_minimum"),
      );
      const failed = fields.filter((field) => onFields[field]);
      const [first] = failed;
      if (first) {
        for (const field of failed)
          setError(field, { message: onFields[field] });
        setFocus(first);
        return;
      }
      setProblem(error);
    }
  });

  const copies = [
    t("vanCopiesCorridor", {
      origin: route.corridor.origin_area.name,
      destination: route.corridor.destination_area.name,
    }),
    route.served_areas.length > 0 ? t("vanCopiesAreas") : null,
    route.school_name !== null
      ? t("vanCopiesSchool", { school: route.school_name })
      : null,
    route.company !== null
      ? t("vanCopiesCompany", { company: route.company.name })
      : null,
    route.prices !== null ? t("vanCopiesPrices") : null,
  ].filter((item): item is string => item !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted meanwhile, or its company was deactivated: the route (and its company) reload
        // once the dialog closes.
        if (
          !next &&
          problem instanceof ApiError &&
          (problem.status === 404 || problem.code === "ROUTE_NOT_READY")
        ) {
          refetchRoute(queryClient, route.id);
          void queryClient.invalidateQueries({ queryKey: companyKeys.all });
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
        onCloseAutoFocus={(event) => {
          if (addedVan) event.preventDefault();
          else returnFocus(event, returnFocusTo.current);
        }}
      >
        <div className="grid gap-2">
          <DialogTitle>{t("vanTitle", { code: route.code })}</DialogTitle>
          {/* The list is part of the description, so it's announced with the dialog. */}
          <DialogDescription asChild>
            <div className="grid gap-1">
              <p>{t("vanHint", { code: route.code })}</p>
              <ul className="list-disc pl-5">
                {copies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={
                problem instanceof ApiError &&
                problem.code === "ROUTE_NOT_READY"
                  ? t("vanCompanyInactive")
                  : message(problem)
              }
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <FormField
            id={`${uid}-van-code`}
            label={t("codeLabel")}
            hint={t("codeHint")}
            error={errors.code}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={CODE_MAX}
                autoComplete="off"
                className="font-mono uppercase"
                {...register("code")}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${uid}-van-seats`}
              label={t("seatsLabel")}
              hint={t("seatsHint")}
              error={errors.seats}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={SEATS_MAX}
                  {...register("seats")}
                />
              )}
            </FormField>
            {!corporate && (
              <FormField
                id={`${uid}-van-launch-minimum`}
                label={t("launchMinimumLabel")}
                hint={t("launchMinimumHint")}
                error={errors.launch_minimum}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={SEATS_MAX}
                    {...register("launch_minimum")}
                  />
                )}
              </FormField>
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
              {t("addVan")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
