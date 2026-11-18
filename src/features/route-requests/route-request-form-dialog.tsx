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
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { AreaPicker } from "@/components/pickers/area-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { useRoute } from "@/features/routes/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { mobileE164, PHONE_TYPED_MAX } from "@/lib/phone";
import {
  refetchRequest,
  routeSearch,
  useCreateRouteRequest,
  useUpdateRouteRequest,
  type RiderType,
} from "./queries";
import { AskedFor, riderLabel } from "./request-labels";

type RouteRequestRead = components["schemas"]["RouteRequestRead"];
type RouteRequestCreate = components["schemas"]["RouteRequestCreate"];
type RouteRequestUpdate = components["schemas"]["RouteRequestUpdate"];
type AreaRef = components["schemas"]["AreaRef"];
type RouteRef = components["schemas"]["RouteRef"];

// The contract's limits (RouteRequestCreate / RouteRequestUpdate).
const TEXT_MAX = 100;
const NOTES_MAX = 1000;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Text as the API compares and counts it: NFC, one space between words, trimmed. */
const sameLooking = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, " ").trim();

const chosen = <T,>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

/** The API's field names → the form's, for its 422s. */
const apiFields = {
  from_area_id: "fromArea",
  from_area_name: "fromName",
  to_area_id: "toArea",
  to_area_name: "toName",
  route_id: "route",
  rider_name: "rider_name",
  school_name: "school_name",
  preferred_morning_time: "morning",
  preferred_return_time: "back",
  contact_name: "contact_name",
  contact_phone: "contact_phone",
  notes: "notes",
} as const;

type RouteRequestFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The request to correct; omitted to record one (from a phone call). */
  request?: RouteRequestRead;
  /** The new request, once recorded: the caller opens it. */
  onRecorded?: (request: RouteRequestRead) => void;
  /**
   * Recording a seat on a full route for a known adult (GZW-031): the route and who they are,
   * filled in and still editable.
   */
  prefill?: { route: RouteRef; riderName: string; phone: string };
};

/**
 * Record a route request from a phone call, or correct one (GZW-040). Recording: what's asked
 * (new areas – each end a listed area or a name not listed yet – or a seat on a running route),
 * who rides, preferred times and who to call. Correcting: who and when only; what's asked is
 * fixed. Mount it with a new `key` each time it opens: every record has its own Idempotency-Key,
 * kept for its retries. Names and phones only go to the API, never into URLs, toasts or logs.
 */
export function RouteRequestFormDialog({
  open,
  onOpenChange,
  request: requestProp,
  onRecorded,
  prefill,
}: RouteRequestFormDialogProps) {
  // The request as the form opened with it: changes are worked out against this.
  const [request] = useState(requestProp);
  const t = useTranslations("RouteRequests");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateRouteRequest();
  const update = useUpdateRouteRequest();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  // Recorded: the new request opens and takes focus itself; the dialog doesn't hand focus back.
  const [recorded, setRecorded] = useState(false);
  // The route a refused record asked for (the picker may change after).
  const [sentRoute, setSentRoute] = useState<RouteRef | null>(null);
  // Correcting a student's request that names a route (asked for, or matched while open): the
  // school must stay the route's, so it's shown, not edited.
  const schoolFixedOnEdit =
    request !== undefined &&
    request.rider_type === "student" &&
    (request.route !== null ||
      ((request.status === "new" || request.status === "matched") &&
        request.matched_route !== null));
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, the button stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);

  const schema = useMemo(() => {
    const text = (value: string) => {
      const length = sameLooking(value).length;
      return length > 0 && length <= TEXT_MAX;
    };
    return z
      .object({
        kind: z.enum(["new_areas", "route"]),
        fromMode: z.enum(["listed", "named"]),
        fromArea: chosen<AreaRef>().nullable(),
        fromName: z.string().trim(),
        toMode: z.enum(["listed", "named"]),
        toArea: chosen<AreaRef>().nullable(),
        toName: z.string().trim(),
        route: chosen<RouteRef>().nullable(),
        rider_type: z.enum(["adult", "student"]),
        rider_name: z.string().trim(),
        school_name: z.string().trim(),
        morning: z.string(),
        back: z.string(),
        contact_name: z.string().trim(),
        contact_phone: z.string().trim(),
        notes: z.string().trim(),
      })
      .superRefine((values, ctx) => {
        const issue = (path: string, words: string) =>
          ctx.addIssue({ code: "custom", path: [path], message: words });
        if (!request) {
          if (values.kind === "new_areas") {
            for (const end of ["from", "to"] as const) {
              const named = values[`${end}Mode`] === "named";
              const name = values[`${end}Name`];
              if (named && !name) issue(`${end}Name`, t("endRequired"));
              else if (named && !text(name))
                issue(`${end}Name`, t("endNameTooLong"));
              else if (!named && !values[`${end}Area`])
                issue(`${end}Area`, t("endRequired"));
            }
            const sameArea =
              values.fromMode === "listed" &&
              values.toMode === "listed" &&
              values.fromArea !== null &&
              values.fromArea.id === values.toArea?.id;
            const sameName =
              values.fromMode === "named" &&
              values.toMode === "named" &&
              values.fromName !== "" &&
              sameLooking(values.fromName).toLowerCase() ===
                sameLooking(values.toName).toLowerCase();
            // A typed name that is the other end's listed area names that area (GZ-077).
            const typedIsListed = (typed: string, listed: AreaRef | null) =>
              typed !== "" &&
              listed !== null &&
              sameLooking(typed).toLowerCase() ===
                sameLooking(listed.name).toLowerCase();
            const fromNamesTo =
              values.fromMode === "named" &&
              values.toMode === "listed" &&
              typedIsListed(values.fromName, values.toArea);
            const toNamesFrom =
              values.fromMode === "listed" &&
              values.toMode === "named" &&
              typedIsListed(values.toName, values.fromArea);
            if (sameArea) issue("toArea", t("endsSame"));
            if (sameName) issue("toName", t("endsSame"));
            if (fromNamesTo) issue("fromName", t("endNameIsOther"));
            if (toNamesFrom) issue("toName", t("endNameIsOther"));
          } else if (!values.route) {
            issue("route", t("routeRequired"));
          }
        }
        if (!values.rider_name) issue("rider_name", t("riderNameRequired"));
        else if (!text(values.rider_name)) {
          issue("rider_name", t("riderNameTooLong"));
        }
        // A student names their school; where a route fixes it, it's the route's (not typed).
        const typesSchool =
          values.rider_type === "student" &&
          (request !== undefined
            ? !schoolFixedOnEdit
            : values.kind === "new_areas");
        if (typesSchool && !values.school_name) {
          issue("school_name", t("schoolRequired"));
        } else if (typesSchool && !text(values.school_name)) {
          issue("school_name", t("schoolTooLong"));
        }
        for (const field of ["morning", "back"] as const) {
          const value = values[field];
          const before =
            field === "morning"
              ? request?.preferred_morning_time
              : request?.preferred_return_time;
          if (!value && before) issue(field, t("timeCantClear"));
          else if (value && !TIME.test(value)) issue(field, t("timeInvalid"));
        }
        if (
          TIME.test(values.morning) &&
          TIME.test(values.back) &&
          values.back <= values.morning
        ) {
          issue("back", t("timesOrder"));
        }
        if (!values.contact_name) {
          issue("contact_name", t("contactNameRequired"));
        } else if (!text(values.contact_name)) {
          issue("contact_name", t("contactNameTooLong"));
        }
        if (
          values.contact_phone.length > PHONE_TYPED_MAX ||
          mobileE164(values.contact_phone) === null
        ) {
          issue("contact_phone", t("phoneInvalid"));
        }
        if (values.notes.length > NOTES_MAX) issue("notes", t("notesTooLong"));
      });
  }, [t, request, schoolFixedOnEdit]);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: request?.kind ?? (prefill ? "route" : "new_areas"),
      fromMode: "listed",
      fromArea: null,
      fromName: "",
      toMode: "listed",
      toArea: null,
      toName: "",
      route: prefill?.route ?? null,
      rider_type: request?.rider_type ?? "adult",
      rider_name: request?.rider_name ?? prefill?.riderName ?? "",
      school_name: request?.school_name ?? "",
      morning: request?.preferred_morning_time ?? "",
      back: request?.preferred_return_time ?? "",
      contact_name: request?.contact_name ?? prefill?.riderName ?? "",
      contact_phone: request?.contact_phone ?? prefill?.phone ?? "",
      notes: request?.notes ?? "",
    },
  });
  const kind = useWatch({ control, name: "kind" });
  const riderType = useWatch({ control, name: "rider_type" });
  const chosenRoute = useWatch({ control, name: "route" });
  const fromMode = useWatch({ control, name: "fromMode" });
  const toMode = useWatch({ control, name: "toMode" });
  // A student's route request takes the route's school.
  const routeSchoolNeeded =
    !request && kind === "route" && riderType === "student";
  const routeDetail = useRoute(
    routeSchoolNeeded && chosenRoute ? chosenRoute.id : null,
  );
  const routeSchool = routeDetail.data?.school_name ?? null;
  const routeType = riderType === "adult" ? "public" : "student";
  const search = useMemo(
    () => routeSearch(routeType, ["active", "paused"]),
    [routeType],
  );

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    setSentRoute(!request && values.kind === "route" ? values.route : null);
    const phone = mobileE164(values.contact_phone) ?? values.contact_phone;
    try {
      if (request) {
        const change: RouteRequestUpdate = {};
        if (values.rider_name !== request.rider_name) {
          change.rider_name = values.rider_name;
        }
        if (
          request.rider_type === "student" &&
          !schoolFixedOnEdit &&
          values.school_name !== request.school_name
        ) {
          change.school_name = values.school_name;
        }
        if (
          values.morning &&
          values.morning !== request.preferred_morning_time
        ) {
          change.preferred_morning_time = values.morning;
        }
        if (values.back && values.back !== request.preferred_return_time) {
          change.preferred_return_time = values.back;
        }
        if (values.contact_name !== request.contact_name) {
          change.contact_name = values.contact_name;
        }
        if (phone !== request.contact_phone) {
          change.contact_phone = values.contact_phone;
        }
        // Empty notes clear them.
        if (values.notes !== (request.notes ?? "")) change.notes = values.notes;
        if (Object.keys(change).length > 0) {
          await update.mutateAsync({ id: request.id, change });
          showSuccessToast(t("savedToast"));
        }
        onOpenChange(false);
        return;
      }
      const body: RouteRequestCreate = {
        kind: values.kind,
        rider_type: values.rider_type,
        rider_name: values.rider_name,
        contact_name: values.contact_name,
        contact_phone: values.contact_phone,
      };
      if (values.kind === "new_areas") {
        if (values.fromMode === "listed")
          body.from_area_id = values.fromArea?.id;
        else body.from_area_name = values.fromName;
        if (values.toMode === "listed") body.to_area_id = values.toArea?.id;
        else body.to_area_name = values.toName;
        if (values.rider_type === "student") {
          body.school_name = values.school_name;
        }
      } else {
        body.route_id = values.route?.id;
        if (values.rider_type === "student") {
          if (routeSchool === null) {
            // The route's school isn't known yet (loading, or its load failed: see the alert).
            setError("route", { message: t("schoolRouteWait") });
            setFocus("route");
            return;
          }
          body.school_name = routeSchool;
        }
      }
      if (values.morning) body.preferred_morning_time = values.morning;
      if (values.back) body.preferred_return_time = values.back;
      if (values.notes) body.notes = values.notes;
      const added = await create.mutateAsync({
        request: body,
        idempotencyKey,
      });
      showSuccessToast(t("recordedToast"));
      setRecorded(true);
      onOpenChange(false);
      onRecorded?.(added);
    } catch (error) {
      showRefusal(error);
    }
  });

  /** A refusal on a field goes there (and gets focus); anything else above the form. */
  function showRefusal(error: unknown) {
    const fields = fieldMessages(error);
    const failed = Object.entries(apiFields).filter(
      ([apiField]) => fields[apiField],
    );
    const [first] = failed;
    if (first) {
      for (const [apiField, field] of failed) {
        let words = fields[apiField];
        if (apiField === "route_id") words = t("routeNotFor");
        // A typed name the API matched to the listed area at the other end (GZ-077).
        if (apiField === "from_area_name" || apiField === "to_area_name") {
          words = t("endNameIsOther");
        }
        if (apiField === "school_name" && request) words = t("schoolNotRoute");
        setError(field, { message: words });
      }
      setFocus(first[1]);
      return;
    }
    setProblem(error);
  }

  const exists =
    problem instanceof ApiError && problem.code === "ROUTE_REQUEST_EXISTS";
  // The route the existing request asks for: its open requests are one link away.
  const existsRoute = sentRoute;
  let problemWords = "";
  if (exists && request) problemWords = t("existsEdit");
  else if (exists && existsRoute) {
    problemWords = t("existsRoute", { code: existsRoute.code });
  } else if (exists) problemWords = t("existsAreas");
  else if (problem !== null) problemWords = message(problem);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted while being corrected: its detail shows that once the form closes.
        if (
          !next &&
          request &&
          problem instanceof ApiError &&
          problem.status === 404
        ) {
          refetchRequest(queryClient, request.id);
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
          <DialogTitle>{t(request ? "editTitle" : "addTitle")}</DialogTitle>
          <DialogDescription>
            {t(request ? "editHint" : "formHint")}
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
              {exists && !request && (
                <Link
                  href={
                    existsRoute
                      ? `/route-requests?route_id=${existsRoute.id}&open=true`
                      : "/route-requests?kind=new_areas&open=true"
                  }
                  // The list may be the page behind the dialog: it closes as the list filters.
                  onClick={() => onOpenChange(false)}
                  className="w-fit text-table font-semibold text-royal underline-offset-4 hover:underline"
                >
                  {existsRoute
                    ? t("existsRouteLink", { code: existsRoute.code })
                    : t("existsAreasLink")}
                </Link>
              )}
            </div>
          )}

          {request ? (
            // What's asked and who rides are fixed once recorded.
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <dt className="text-meta font-semibold text-muted">
                  {t("asked")}
                </dt>
                <dd className="text-body text-ink">
                  <AskedFor request={request} />
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-meta font-semibold text-muted">
                  {t("rider")}
                </dt>
                <dd className="text-body text-ink">
                  {riderLabel({ ...request, school_name: null }, t)}
                </dd>
              </div>
            </dl>
          ) : (
            <>
              <RadioGroup
                legend={t("kindLegend")}
                name="kind"
                register={register}
                options={[
                  { value: "new_areas", label: t("kindNewAreasOption") },
                  { value: "route", label: t("kindRouteOption") },
                ]}
              />
              <RadioGroup
                legend={t("riderTypeLegend")}
                name="rider_type"
                register={register}
                inline
                // Another kind of rider fits other routes: the chosen one is cleared.
                onChange={() => setValue("route", null)}
                options={[
                  { value: "adult", label: t("riderAdultOption") },
                  { value: "student", label: t("riderStudentOption") },
                ]}
              />
              {kind === "new_areas" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <AreaEnd
                    end="from"
                    legend={t("fromLegend")}
                    mode={fromMode}
                    uid={uid}
                    control={control}
                    register={register}
                    errors={errors}
                  />
                  <AreaEnd
                    end="to"
                    legend={t("toLegend")}
                    mode={toMode}
                    uid={uid}
                    control={control}
                    register={register}
                    errors={errors}
                  />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${uid}-route`}>{t("routeLabel")}</Label>
                  <Controller
                    control={control}
                    name="route"
                    render={({ field }) => (
                      <RoutePicker
                        id={`${uid}-route`}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? null}
                        onChange={field.onChange}
                        search={search}
                        scope={`running-${routeType}`}
                        invalid={Boolean(errors.route)}
                        aria-describedby={
                          errors.route
                            ? `${uid}-route-hint ${uid}-route-error`
                            : `${uid}-route-hint`
                        }
                      />
                    )}
                  />
                  <p id={`${uid}-route-hint`} className="text-table text-muted">
                    {t(
                      riderType === "adult"
                        ? "routeHintAdult"
                        : "routeHintStudent",
                    )}
                  </p>
                  {errors.route && (
                    <p
                      id={`${uid}-route-error`}
                      className="text-table text-danger"
                    >
                      {errors.route.message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${uid}-rider-name`}
              label={t("riderNameLabel")}
              hint={
                riderType === "student" ? t("riderNameHintStudent") : undefined
              }
              error={errors.rider_name}
            >
              {(aria) => (
                <Input
                  {...aria}
                  maxLength={TEXT_MAX}
                  autoComplete="off"
                  {...register("rider_name")}
                />
              )}
            </FormField>
            {riderType === "student" &&
              (routeSchoolNeeded ? (
                <div className="grid content-start gap-1.5">
                  <p className="text-table font-semibold text-ink">
                    {t("schoolLabel")}
                  </p>
                  {chosenRoute && routeDetail.isError ? (
                    <ProblemAlert
                      message={message(routeDetail.error)}
                      requestId={
                        routeDetail.error instanceof ApiError
                          ? routeDetail.error.requestId
                          : null
                      }
                      retryAfterSeconds={
                        routeDetail.error instanceof ApiError
                          ? routeDetail.error.retryAfterSeconds
                          : null
                      }
                      onRetry={() => void routeDetail.refetch()}
                    />
                  ) : (
                    <p className="text-body text-ink">
                      {routeSchool !== null
                        ? t("schoolFromRoute", { school: routeSchool })
                        : t(chosenRoute ? "loadingName" : "schoolPending")}
                    </p>
                  )}
                </div>
              ) : schoolFixedOnEdit ? (
                <div className="grid content-start gap-1.5">
                  <p className="text-table font-semibold text-ink">
                    {t("schoolLabel")}
                  </p>
                  <p className="text-body text-ink">
                    {t("schoolFromRoute", {
                      school: request?.school_name ?? "",
                    })}
                  </p>
                </div>
              ) : (
                <FormField
                  id={`${uid}-school`}
                  label={t("schoolLabel")}
                  error={errors.school_name}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      maxLength={TEXT_MAX}
                      autoComplete="off"
                      {...register("school_name")}
                    />
                  )}
                </FormField>
              ))}
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-table font-semibold text-ink">
              {t("timesLegend")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["morning", "back"] as const).map((field) => (
                <FormField
                  key={field}
                  id={`${uid}-${field}`}
                  label={t(
                    field === "morning" ? "morningLabel" : "returnLabel",
                  )}
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
              id={`${uid}-contact-name`}
              label={t("contactNameLabel")}
              hint={t("contactNameHint")}
              error={errors.contact_name}
            >
              {(aria) => (
                <Input
                  {...aria}
                  maxLength={TEXT_MAX}
                  autoComplete="off"
                  {...register("contact_name")}
                />
              )}
            </FormField>
            <FormField
              id={`${uid}-contact-phone`}
              label={t("contactPhoneLabel")}
              hint={t("contactPhoneHint")}
              error={errors.contact_phone}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="tel"
                  inputMode="tel"
                  maxLength={PHONE_TYPED_MAX}
                  autoComplete="off"
                  {...register("contact_phone")}
                />
              )}
            </FormField>
          </div>

          <FormField
            id={`${uid}-notes`}
            label={t("notesLabel")}
            hint={t("notesHint")}
            error={errors.notes}
          >
            {(aria) => (
              <Textarea
                {...aria}
                maxLength={NOTES_MAX}
                rows={3}
                {...register("notes")}
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
              pending={pending}
              aria-disabled={waiting || undefined}
            >
              {t(request ? "save" : "record")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FormValues = {
  kind: "new_areas" | "route";
  fromMode: "listed" | "named";
  fromArea: AreaRef | null;
  fromName: string;
  toMode: "listed" | "named";
  toArea: AreaRef | null;
  toName: string;
  route: RouteRef | null;
  rider_type: RiderType;
  rider_name: string;
  school_name: string;
  morning: string;
  back: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
};

/** Radio buttons in a fieldset with a legend. */
function RadioGroup({
  legend,
  name,
  register,
  options,
  inline,
  onChange,
}: {
  legend: string;
  name: "kind" | "rider_type" | "fromMode" | "toMode";
  register: UseFormRegister<FormValues>;
  options: { value: string; label: ReactNode }[];
  inline?: boolean;
  onChange?: () => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-table font-semibold text-ink">
        {legend}
      </legend>
      <div className={inline ? "flex flex-wrap gap-x-6 gap-y-2" : "grid gap-2"}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 text-body text-ink"
          >
            <input
              type="radio"
              value={option.value}
              className="size-4 shrink-0 accent-royal"
              {...register(name, { onChange })}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** One end of a new-areas request: a listed area (picker), or the name of one not listed yet. */
function AreaEnd({
  end,
  legend,
  mode,
  uid,
  control,
  register,
  errors,
}: {
  end: "from" | "to";
  legend: string;
  mode: "listed" | "named";
  uid: string;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}) {
  const t = useTranslations("RouteRequests");
  const areaError = errors[`${end}Area`];
  const pickerId = `${uid}-${end}-area`;
  return (
    <fieldset className="grid content-start gap-3 rounded-lg border border-line p-4">
      <legend className="px-1 text-table font-semibold text-ink">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(["listed", "named"] as const).map((value) => (
          <label
            key={value}
            className="flex items-center gap-2 text-body text-ink"
          >
            <input
              type="radio"
              value={value}
              className="size-4 shrink-0 accent-royal"
              {...register(`${end}Mode`)}
            />
            {t(value === "listed" ? "endListed" : "endNamed")}
          </label>
        ))}
      </div>
      {mode === "listed" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={pickerId}>{t("endAreaLabel", { end: legend })}</Label>
          <Controller
            control={control}
            name={`${end}Area`}
            render={({ field }) => (
              <AreaPicker
                id={pickerId}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? null}
                onChange={field.onChange}
                invalid={Boolean(areaError)}
                aria-describedby={areaError ? `${pickerId}-error` : undefined}
              />
            )}
          />
          {areaError && (
            <p id={`${pickerId}-error`} className="text-table text-danger">
              {areaError.message}
            </p>
          )}
        </div>
      ) : (
        <FormField
          id={`${uid}-${end}-name`}
          label={t("endNameLabel", { end: legend })}
          hint={t("endNameHint")}
          error={errors[`${end}Name`]}
        >
          {(aria) => (
            <Input
              {...aria}
              maxLength={TEXT_MAX}
              autoComplete="off"
              {...register(`${end}Name`)}
            />
          )}
        </FormField>
      )}
    </fieldset>
  );
}
