"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldError,
} from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { AreaPicker } from "@/components/pickers/area-picker";
import { CompanyPicker } from "@/components/pickers/company-picker";
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
import { mobileE164, PHONE_TYPED_MAX } from "@/lib/phone";
import {
  findRidersByPhone,
  refetchRider,
  useCreateRider,
  useUpdateRider,
  type RiderPlan,
} from "./queries";
import { riderTypeLabel } from "./rider-labels";

type RiderRead = components["schemas"]["RiderRead"];
type RiderCreate = components["schemas"]["RiderCreate"];
type RiderUpdate = components["schemas"]["RiderUpdate"];
type AreaRef = components["schemas"]["AreaRef"];
type CompanyRef = components["schemas"]["CompanyRef"];

// The contract's limit (RiderCreate / RiderUpdate).
const NAME_MAX = 100;
const PLANS: RiderPlan[] = ["round_trip", "morning", "evening"];
/** The fields top to bottom: the first one in error takes focus. */
const FIELD_ORDER = [
  "full_name",
  "phone",
  "company",
  "home",
  "destination",
  "plan",
  "saturday",
] as const;

/** Text as the API compares and counts it: NFC, one space between words, trimmed. */
const sameLooking = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, " ").trim();

const chosen = <T,>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

/** The API's field names → the form's, for its 422s. */
const apiFields = {
  full_name: "full_name",
  phone: "phone",
  company_id: "company",
  home_area_id: "home",
  destination_area_id: "destination",
  plan: "plan",
  saturday_addon: "saturday",
} as const;

type FormValues = {
  rider_type: "adult" | "corporate";
  full_name: string;
  phone: string;
  company: CompanyRef | null;
  home: AreaRef | null;
  destination: AreaRef | null;
  plan: RiderPlan | null;
  saturday: boolean;
};

type RiderFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rider to correct; omitted to record one. */
  rider?: RiderRead;
  /** Recording: a phone already typed (a phone search that found nobody). */
  initialPhone?: string;
  /** The new rider, once recorded: the caller opens them. */
  onRecorded?: (rider: RiderRead) => void;
};

/**
 * Record a rider, or correct one (GZW-030). Recording: an adult from a phone call (where they
 * board and go, plan, Saturday add-on) or a company rider (their company and where they board).
 * Correcting: a company rider's name, phone and where they board; anyone else's details too.
 * Their type and company never change. Mount it with a new `key` each time it opens: every
 * record has its own Idempotency-Key, kept for its retries. Names and phones only go to the API,
 * never into URLs, toasts or logs.
 */
export function RiderFormDialog({
  open,
  onOpenChange,
  rider: riderProp,
  initialPhone = "",
  onRecorded,
}: RiderFormDialogProps) {
  // The rider as the form opened with them: changes are worked out against this.
  const [rider] = useState(riderProp);
  const t = useTranslations("Riders");
  const tCommon = useTranslations("Common");
  // Ids unique to this instance (see RouteRequestFormDialog).
  const uid = useId();
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateRider();
  const update = useUpdateRider();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  // A refused record's phone already belongs to this rider: one link away.
  const [existing, setExisting] = useState<{
    id: string;
    full_name: string;
  } | null>(null);
  // Recorded: the new rider opens and takes focus itself; the dialog doesn't hand focus back.
  const [recorded, setRecorded] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, the button stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  // Correcting: their type is fixed. Recording: the type chosen.
  const fixedCompany = rider ? rider.rider_type === "corporate" : null;

  const schema = useMemo(
    () =>
      z
        .object({
          rider_type: z.enum(["adult", "corporate"]),
          full_name: z.string(),
          phone: z.string().trim(),
          company: chosen<CompanyRef>().nullable(),
          home: chosen<AreaRef>().nullable(),
          destination: chosen<AreaRef>().nullable(),
          plan: z.enum(["round_trip", "morning", "evening"]).nullable(),
          saturday: z.boolean(),
        })
        .superRefine((values, ctx) => {
          const issue = (path: keyof FormValues, words: string) =>
            ctx.addIssue({ code: "custom", path: [path], message: words });
          const name = sameLooking(values.full_name);
          if (!name) issue("full_name", t("nameRequired"));
          else if (name.length > NAME_MAX) issue("full_name", t("nameTooLong"));
          if (
            values.phone.length > PHONE_TYPED_MAX ||
            mobileE164(values.phone) === null
          ) {
            issue("phone", t("phoneInvalid"));
          }
          if (!values.home) issue("home", t("homeRequired"));
          if (fixedCompany ?? values.rider_type === "corporate") {
            if (!rider && !values.company) {
              issue("company", t("companyRequired"));
            }
            return;
          }
          if (!values.destination) {
            issue("destination", t("destinationRequired"));
          } else if (values.home && values.home.id === values.destination.id) {
            issue("destination", t("sameAreas"));
          }
          if (!values.plan) issue("plan", t("planRequired"));
        }),
    [t, rider, fixedCompany],
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
    // Focus goes to the first field in error as the form shows them (onInvalid below).
    shouldFocusError: false,
    defaultValues: {
      rider_type: "adult",
      full_name: rider?.full_name ?? "",
      phone: rider?.phone ?? initialPhone,
      company: null,
      home: rider?.home_area ?? null,
      destination: rider?.destination_area ?? null,
      plan: rider?.plan ?? null,
      saturday: rider?.saturday_addon ?? false,
    },
  });
  const riderType = useWatch({ control, name: "rider_type" });
  const company = fixedCompany ?? riderType === "corporate";

  const onSubmit = handleSubmit(
    async (values) => {
      setProblem(null);
      setExisting(null);
      const name = sameLooking(values.full_name);
      const phone = mobileE164(values.phone) ?? values.phone;
      try {
        if (rider) {
          const change: RiderUpdate = {};
          if (name !== rider.full_name) change.full_name = name;
          if (phone !== rider.phone) change.phone = values.phone;
          if (values.home && values.home.id !== rider.home_area?.id) {
            change.home_area_id = values.home.id;
          }
          if (!company) {
            if (
              values.destination &&
              values.destination.id !== rider.destination_area?.id
            ) {
              change.destination_area_id = values.destination.id;
            }
            if (values.plan && values.plan !== rider.plan) {
              change.plan = values.plan;
            }
            if (values.saturday !== rider.saturday_addon) {
              change.saturday_addon = values.saturday;
            }
          }
          if (Object.keys(change).length > 0) {
            await update.mutateAsync({ id: rider.id, change });
            showSuccessToast(t("savedToast"));
          }
          onOpenChange(false);
          return;
        }
        const body: RiderCreate = {
          rider_type: values.rider_type,
          full_name: name,
          phone: values.phone,
          home_area_id: values.home?.id ?? "",
          saturday_addon: false,
        };
        if (values.rider_type === "corporate") {
          body.company_id = values.company?.id;
        } else {
          body.destination_area_id = values.destination?.id;
          body.plan = values.plan ?? undefined;
          body.saturday_addon = values.saturday;
        }
        const added = await create.mutateAsync({ rider: body, idempotencyKey });
        showSuccessToast(t("recordedToast"));
        setRecorded(true);
        onOpenChange(false);
        onRecorded?.(added);
      } catch (error) {
        await showRefusal(error, values, phone);
      }
    },
    (invalid) => {
      const first = FIELD_ORDER.find((field) => invalid[field]);
      if (first) setFocus(first);
    },
  );

  /** A refusal on a field goes there (and gets focus); anything else above the form. */
  async function showRefusal(
    error: unknown,
    values: FormValues,
    phone: string,
  ) {
    if (error instanceof ApiError && error.code === "RIDER_EXISTS") {
      if (rider) {
        setError("phone", { message: t("phoneTakenEdit") });
        setFocus("phone");
        return;
      }
      setProblem(error);
      // Which rider has it: an adult's phone is theirs alone, a company rider's once per company.
      try {
        const matches = await findRidersByPhone(phone);
        const match = matches.items.find((item) =>
          values.rider_type === "corporate"
            ? item.company?.id === values.company?.id
            : item.rider_type === "adult",
        );
        if (match) setExisting({ id: match.id, full_name: match.full_name });
      } catch {
        // The message stands without the link.
      }
      return;
    }
    const fields = fieldMessages(error);
    const failed = Object.entries(apiFields).filter(
      ([apiField]) => fields[apiField],
    );
    const [first] = failed;
    if (first) {
      for (const [apiField, field] of failed) {
        let words = fields[apiField];
        // A seat holder's change that doesn't fit their route.
        if (rider?.seat && apiField === "home_area_id") {
          words = t("homeNotOnRoute", { code: rider.seat.route_code });
        } else if (rider?.seat && apiField === "destination_area_id") {
          words = t("destinationNotOnRoute", { code: rider.seat.route_code });
        } else if (rider?.seat && apiField === "saturday_addon") {
          words = t("saturdayNotOnRoute", { code: rider.seat.route_code });
        }
        setError(field, { message: words });
      }
      setFocus(first[1]);
      return;
    }
    setProblem(error);
  }

  const exists = problem instanceof ApiError && problem.code === "RIDER_EXISTS";
  const problemWords = exists
    ? t(riderType === "corporate" ? "existsCompany" : "existsAdult")
    : problem !== null
      ? message(problem)
      : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted while being corrected: their detail shows that once the form closes.
        if (
          !next &&
          rider &&
          problem instanceof ApiError &&
          problem.status === 404
        ) {
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
          if (recorded) event.preventDefault();
          else returnFocus(event, returnFocusTo.current);
        }}
      >
        <div className="grid gap-1">
          <DialogTitle>{t(rider ? "editTitle" : "addTitle")}</DialogTitle>
          <DialogDescription>
            {t(rider ? (company ? "editHintCompany" : "editHint") : "formHint")}
          </DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
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
              {existing && (
                <Link
                  href={`/riders/${existing.id}`}
                  onClick={() => onOpenChange(false)}
                  className="w-fit text-table font-semibold text-royal underline-offset-4 hover:underline"
                >
                  {t("existsLink", { name: existing.full_name })}
                </Link>
              )}
            </div>
          )}

          {rider ? (
            <p className="text-body text-ink">
              {rider.company
                ? t("typeCompanyAt", { company: rider.company.name })
                : riderTypeLabel(rider.rider_type, t)}
            </p>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-table font-semibold text-ink">
                {t("typeLegend")}
              </legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(["adult", "corporate"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-body text-ink"
                  >
                    <input
                      type="radio"
                      value={value}
                      className="size-4 shrink-0 accent-royal"
                      {...register("rider_type")}
                    />
                    {t(
                      value === "adult"
                        ? "typeAdultOption"
                        : "typeCompanyOption",
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${uid}-name`}
              label={t("nameLabel")}
              error={errors.full_name}
            >
              {(aria) => (
                <Input
                  {...aria}
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  {...register("full_name")}
                />
              )}
            </FormField>
            <FormField
              id={`${uid}-phone`}
              label={t("phoneLabel")}
              hint={t("phoneHint")}
              error={errors.phone}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="tel"
                  inputMode="tel"
                  maxLength={PHONE_TYPED_MAX}
                  autoComplete="off"
                  {...register("phone")}
                />
              )}
            </FormField>
          </div>

          {company && !rider && (
            <PickerField
              id={`${uid}-company`}
              label={t("companyLabel")}
              hint={t("companyHint")}
              error={errors.company}
            >
              {(aria) => (
                <Controller
                  control={control}
                  name="company"
                  render={({ field }) => (
                    <CompanyPicker
                      {...aria}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </PickerField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AreaField
              id={`${uid}-home`}
              name="home"
              label={t("homeLabel")}
              hint={t(company ? "homeHintCompany" : "homeHint")}
              control={control}
              error={errors.home}
            />
            {!company && (
              <AreaField
                id={`${uid}-destination`}
                name="destination"
                label={t("destinationLabel")}
                control={control}
                error={errors.destination}
              />
            )}
          </div>

          {!company && (
            <>
              <fieldset
                className="grid gap-2"
                aria-describedby={errors.plan ? `${uid}-plan-error` : undefined}
              >
                <legend className="mb-1 text-table font-semibold text-ink">
                  {t("planLegend")}
                </legend>
                <div className="grid gap-2">
                  {PLANS.map((value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-body text-ink"
                    >
                      <input
                        type="radio"
                        value={value}
                        className="size-4 shrink-0 accent-royal"
                        {...register("plan")}
                      />
                      {t(
                        value === "round_trip"
                          ? "planRoundTripOption"
                          : value === "morning"
                            ? "planMorningOption"
                            : "planEveningOption",
                      )}
                    </label>
                  ))}
                </div>
                {errors.plan && (
                  <p
                    id={`${uid}-plan-error`}
                    className="text-table text-danger"
                  >
                    {errors.plan.message}
                  </p>
                )}
              </fieldset>
              <div className="grid gap-1">
                <label className="flex items-center gap-2 text-body text-ink">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-royal"
                    aria-describedby={
                      errors.saturday
                        ? `${uid}-saturday-hint ${uid}-saturday-error`
                        : `${uid}-saturday-hint`
                    }
                    aria-invalid={errors.saturday ? true : undefined}
                    {...register("saturday")}
                  />
                  {t("saturdayLabel")}
                </label>
                <p
                  id={`${uid}-saturday-hint`}
                  className="text-table text-muted"
                >
                  {t("saturdayHint")}
                </p>
                {errors.saturday && (
                  <p
                    id={`${uid}-saturday-error`}
                    className="text-table text-danger"
                  >
                    {errors.saturday.message}
                  </p>
                )}
              </div>
            </>
          )}

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
              {t(rider ? "save" : "record")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AriaProps = {
  id: string;
  invalid: boolean;
  "aria-describedby"?: string;
};

/** A labelled picker with its hint and error, linked for screen readers. */
function PickerField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: Pick<FieldError, "message">;
  children: (aria: AriaProps) => ReactNode;
}) {
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        invalid: Boolean(error),
        "aria-describedby": described || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-table text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-table text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}

function AreaField({
  id,
  name,
  label,
  hint,
  control,
  error,
}: {
  id: string;
  name: "home" | "destination";
  label: string;
  hint?: string;
  control: Control<FormValues>;
  error?: Pick<FieldError, "message">;
}) {
  return (
    <PickerField id={id} label={label} hint={hint} error={error}>
      {(aria) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <AreaPicker
              {...aria}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value ?? null}
              onChange={field.onChange}
            />
          )}
        />
      )}
    </PickerField>
  );
}
