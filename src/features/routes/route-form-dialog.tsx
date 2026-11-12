"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { CompanyPicker } from "@/components/pickers/company-picker";
import { CorridorField } from "@/components/pickers/corridor-field";
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
import { refetchRoute, useCreateRoute, useUpdateRoute } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type RouteCreate = components["schemas"]["RouteCreate"];
type RouteUpdate = components["schemas"]["RouteUpdate"];
type RouteType = components["schemas"]["RouteType"];

// The contract's limits (RouteCreate / RouteUpdate).
const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,18}[A-Za-z0-9]$/;
const CODE_MAX = 20;
const SCHOOL_MAX = 100;
const SEATS_MAX = 60;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const TIMES = [
  "morning_time",
  "morning_arrival_time",
  "return_time",
  "return_arrival_time",
] as const;
const TYPES: RouteType[] = ["public", "student", "corporate"];

/** The API's field names → the form's, for its 422s and field refusals. */
const apiFields = {
  code: "code",
  corridor_id: "corridor",
  school_name: "school_name",
  company_id: "company",
  morning_time: "morning_time",
  morning_arrival_time: "morning_arrival_time",
  return_time: "return_time",
  return_arrival_time: "return_arrival_time",
  seats: "seats",
  launch_minimum: "launch_minimum",
} as const;

type CorridorRef = components["schemas"]["CorridorRef"];
type CompanyRef = components["schemas"]["CompanyRef"];
const chosen = <T,>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

type RouteFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The route to edit; omitted to add one (a draft). */
  route?: RouteRead;
  /** Adding: the corridor to start from (e.g. one route requests ask for). */
  initialCorridor?: CorridorRef;
};

/**
 * Add or edit a route: code, corridor (two areas), type (fixed once added) with its school or
 * company, the four times, seats and launch minimum. Mount it with a new `key` each time it
 * opens, so every add gets a fresh form and its own Idempotency-Key (kept for its retries).
 */
export function RouteFormDialog({
  open,
  onOpenChange,
  route: routeProp,
  initialCorridor,
}: RouteFormDialogProps) {
  // The route as the form opened with it: changes are worked out against this, so a refetch
  // while the form is open can't turn someone else's change into one of ours.
  const [route] = useState(routeProp);
  const t = useTranslations("Routes");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateRoute();
  const update = useUpdateRoute();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  // A route made before arrival times existed may keep both unset.
  const arrivalsOptional =
    route !== undefined &&
    route.morning_arrival_time === null &&
    route.return_arrival_time === null;

  const schema = useMemo(
    () =>
      z
        .object({
          code: z.string().trim(),
          corridor: chosen<CorridorRef>().nullable(),
          route_type: z.enum(["public", "student", "corporate"]),
          school_name: z.string().trim(),
          company: chosen<CompanyRef>().nullable(),
          morning_time: z.string(),
          morning_arrival_time: z.string(),
          return_time: z.string(),
          return_arrival_time: z.string(),
          seats: z.string().trim(),
          launch_minimum: z.string().trim(),
        })
        .superRefine((values, ctx) => {
          const issue = (path: string, text: string) =>
            ctx.addIssue({ code: "custom", path: [path], message: text });
          if (!CODE.test(values.code)) issue("code", t("codeInvalid"));
          if (!values.corridor) issue("corridor", t("corridorRequired"));
          if (values.route_type === "student") {
            if (!values.school_name) issue("school_name", t("schoolRequired"));
            else if (values.school_name.length > SCHOOL_MAX) {
              issue("school_name", t("schoolTooLong"));
            }
          }
          if (values.route_type === "corporate" && !values.company) {
            issue("company", t("companyRequired"));
          }
          // Times: each set (arrivals may both stay unset on an older route), each after the
          // one before.
          const arrivalsUnset =
            !values.morning_arrival_time && !values.return_arrival_time;
          let previous: string | null = null;
          for (const field of TIMES) {
            const value = values[field];
            const optional = arrivalsOptional && arrivalsUnset;
            if (!value) {
              if (optional && field.endsWith("arrival_time")) continue;
              issue(
                field,
                arrivalsOptional && field.endsWith("arrival_time")
                  ? t("arrivalsTogether")
                  : t("timeRequired"),
              );
              continue;
            }
            if (!TIME.test(value)) {
              issue(field, t("timeRequired"));
              continue;
            }
            if (previous !== null && value <= previous) {
              issue(field, t("timesOrder"));
            }
            previous = value;
          }
          const seats = wholeNumber(values.seats);
          if (seats === null || seats < 1 || seats > SEATS_MAX) {
            issue("seats", t("seatsInvalid"));
          }
          if (values.route_type !== "corporate") {
            const minimum = wholeNumber(values.launch_minimum);
            if (minimum === null || minimum < 1 || minimum > SEATS_MAX) {
              issue("launch_minimum", t("launchMinimumInvalid"));
            } else if (seats !== null && minimum > seats) {
              issue("launch_minimum", t("launchMinimumAboveSeats"));
            }
          }
        }),
    [t, arrivalsOptional],
  );

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: route?.code ?? "",
      corridor: route?.corridor ?? initialCorridor ?? null,
      route_type: route?.route_type ?? "public",
      school_name: route?.school_name ?? "",
      company: route?.company ?? null,
      morning_time: route?.morning_time ?? "",
      morning_arrival_time: route?.morning_arrival_time ?? "",
      return_time: route?.return_time ?? "",
      return_arrival_time: route?.return_arrival_time ?? "",
      seats: route ? String(route.seats) : "",
      launch_minimum:
        route?.launch_minimum != null ? String(route.launch_minimum) : "",
    },
  });
  const routeType = useWatch({ control, name: "route_type" });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    const code = values.code.toUpperCase();
    const seats = Number(values.seats);
    const minimum =
      values.route_type === "corporate" ? null : Number(values.launch_minimum);
    try {
      if (route) {
        const change: RouteUpdate = {};
        if (code !== route.code) change.code = code;
        if (values.corridor && values.corridor.id !== route.corridor.id) {
          change.corridor_id = values.corridor.id;
        }
        if (
          route.route_type === "student" &&
          values.school_name !== route.school_name
        ) {
          change.school_name = values.school_name;
        }
        if (
          route.route_type === "corporate" &&
          values.company &&
          values.company.id !== route.company?.id
        ) {
          change.company_id = values.company.id;
        }
        for (const field of TIMES) {
          if (values[field] && values[field] !== route[field]) {
            change[field] = values[field];
          }
        }
        if (seats !== route.seats) change.seats = seats;
        if (minimum !== null && minimum !== route.launch_minimum) {
          change.launch_minimum = minimum;
        }
        if (Object.keys(change).length > 0) {
          const saved = await update.mutateAsync({ id: route.id, change });
          showSuccessToast(t("savedToast", { code: saved.code }));
        }
      } else {
        const body: RouteCreate = {
          code,
          corridor_id: values.corridor?.id ?? "",
          route_type: values.route_type,
          morning_time: values.morning_time,
          morning_arrival_time: values.morning_arrival_time,
          return_time: values.return_time,
          return_arrival_time: values.return_arrival_time,
          seats,
        };
        if (minimum !== null) body.launch_minimum = minimum;
        if (values.route_type === "student") {
          body.school_name = values.school_name;
        }
        if (values.route_type === "corporate" && values.company) {
          body.company_id = values.company.id;
        }
        const added = await create.mutateAsync({
          route: body,
          idempotencyKey,
        });
        showSuccessToast(t("addedToast", { code: added.code }));
      }
      onOpenChange(false);
    } catch (error) {
      showRefusal(error);
    }
  });

  /** A refusal on a field goes there (and gets focus); anything else above the form. */
  function showRefusal(error: unknown) {
    const onField = (field: "code" | "seats", text: string) => {
      setError(field, { message: text });
      setFocus(field);
    };
    if (error instanceof ApiError) {
      if (error.code === "ROUTE_CODE_TAKEN")
        return onField("code", t("codeTaken"));
      if (error.code === "SEATS_BELOW_TAKEN") {
        return onField("seats", t("seatsBelowTaken"));
      }
      if (error.code === "SEATS_BELOW_LAUNCH_MINIMUM") {
        return onField("seats", t("seatsBelowLaunchMinimum"));
      }
    }
    const fields = fieldMessages(error);
    const failed = Object.entries(apiFields).filter(
      ([apiField]) => fields[apiField],
    );
    const [first] = failed;
    if (first) {
      for (const [apiField, field] of failed) {
        let text = fields[apiField];
        if (
          apiField === "corridor_id" &&
          route &&
          route.served_areas.length > 0
        ) {
          text = t("corridorHasAreas");
        } else if (apiField === "company_id") {
          text = t("companyNotActive");
        }
        setError(field, { message: text });
      }
      setFocus(first[1]);
      return;
    }
    setProblem(error);
  }

  function problemMessage(error: unknown) {
    if (error instanceof ApiError) {
      // A 422 on the whole request: the times, as stored meanwhile, are out of order.
      if (
        error.code === "VALIDATION_FAILED" &&
        error.fieldErrors.length > 0 &&
        error.fieldErrors.every(
          (fieldError) =>
            fieldError.location === "body" && fieldError.path === "",
        )
      ) {
        return t("timesOrderAlert");
      }
      if (error.code === "ROUTE_HAS_RIDERS") return t("hasRiders");
      if (error.code === "ROUTE_HAS_PRICES") return t("hasPrices");
      if (error.code === "ROUTE_HAS_REQUESTS") return t("hasRequests");
      // New times that clash with another route its driver drives.
      if (error.code === "DRIVER_BUSY") return t("driverBusyTimes");
    }
    return message(error);
  }

  const timeLabels = {
    morning_time: t("leaveALabel"),
    morning_arrival_time: t("arriveBLabel"),
    return_time: t("leaveBLabel"),
    return_arrival_time: t("arriveALabel"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted while being edited: its detail shows that once the form closes.
        if (
          !next &&
          route &&
          problem instanceof ApiError &&
          problem.status === 404
        ) {
          refetchRoute(queryClient, route.id);
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
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>
            {route ? t("editTitle", { code: route.code }) : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={problemMessage(problem)}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <FormField
            id={`${uid}-route-code`}
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

          <div className="grid gap-1.5">
            <Controller
              control={control}
              name="corridor"
              render={({ field }) => (
                <CorridorField
                  id={`${uid}-route-corridor`}
                  legend={t("corridorLegend")}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  invalid={Boolean(errors.corridor)}
                  aria-describedby={
                    errors.corridor ? `${uid}-route-corridor-error` : undefined
                  }
                />
              )}
            />
            {errors.corridor && (
              <p
                id={`${uid}-route-corridor-error`}
                className="text-table text-danger"
              >
                {errors.corridor.message}
              </p>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-table font-semibold text-ink">
              {t("typeLegend")}
            </legend>
            {route ? (
              <p className="text-body text-ink">
                {t(typeKey(route.route_type))}{" "}
                <span className="text-meta text-muted">{t("typeFixed")}</span>
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 text-body text-ink"
                  >
                    <input
                      type="radio"
                      value={type}
                      className="size-4 accent-royal"
                      {...register("route_type")}
                    />
                    {t(typeKey(type))}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {routeType === "student" && (
            <FormField
              id={`${uid}-route-school`}
              label={t("schoolLabel")}
              error={errors.school_name}
            >
              {(aria) => (
                <Input
                  {...aria}
                  maxLength={SCHOOL_MAX}
                  autoComplete="off"
                  {...register("school_name")}
                />
              )}
            </FormField>
          )}
          {routeType === "corporate" && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${uid}-route-company`}>
                {t("companyLabel")}
              </Label>
              <Controller
                control={control}
                name="company"
                render={({ field }) => (
                  <CompanyPicker
                    id={`${uid}-route-company`}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    invalid={Boolean(errors.company)}
                    aria-describedby={
                      errors.company ? `${uid}-route-company-error` : undefined
                    }
                  />
                )}
              />
              {errors.company && (
                <p
                  id={`${uid}-route-company-error`}
                  className="text-table text-danger"
                >
                  {errors.company.message}
                </p>
              )}
            </div>
          )}

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-table font-semibold text-ink">
              {t("timesLegend")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {TIMES.map((field) => (
                <FormField
                  key={field}
                  id={`${uid}-${field}`}
                  label={timeLabels[field]}
                  hint={t("timesHint")}
                  hintHidden
                  error={errors[field]}
                >
                  {(aria) => (
                    <Input {...aria} type="time" {...register(field)} />
                  )}
                </FormField>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${uid}-route-seats`}
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
            {routeType !== "corporate" && (
              <FormField
                id={`${uid}-route-launch-minimum`}
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
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function typeKey(type: RouteType) {
  return type === "public"
    ? "typePublic"
    : type === "student"
      ? "typeStudent"
      : "typeCorporate";
}

function wholeNumber(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}
