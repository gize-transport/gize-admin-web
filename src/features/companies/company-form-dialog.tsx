"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { z } from "zod";
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
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { refetchCompany, useCreateCompany, useUpdateCompany } from "./queries";

type CompanyRead = components["schemas"]["CompanyRead"];
type CompanyCreate = components["schemas"]["CompanyCreate"];
type CompanyUpdate = components["schemas"]["CompanyUpdate"];

// The contract's limits (CompanyCreate / CompanyUpdate).
const NAME_MAX = 100;
const PHONE_TYPED_MAX = 20;
const EMAIL_MAX = 320;
const NOTES_MAX = 1000;
// The contract's `contact_email` pattern (the HTML form rule, ASCII, a dot in the domain).
const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
// The API's Ethiopian mobile rule: separators people type, an optional +251 / 00251 / 251
// (maybe with the trunk 0) or 0, then 9 or 7 and eight digits.
const PHONE_SEPARATORS = /[  \t().-]/g;
const MOBILE = /^(?:(?:\+|00)?2510?|0)?([79][0-9]{8})$/;

/** The number as the API stores it (`+2519…`/`+2517…`), or null if it isn't a mobile. */
export function mobileE164(typed: string): string | null {
  const match = MOBILE.exec(typed.trim().replace(PHONE_SEPARATORS, ""));
  return match ? `+251${match[1]}` : null;
}

const fields = [
  "name",
  "contact_name",
  "contact_phone",
  "contact_email",
  "notes",
] as const;

type CompanyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The company to edit; omitted to add one. */
  company?: CompanyRead;
};

/**
 * Add or edit a company: name, contact person, phone, email and notes. Billing is always postpaid
 * (shown, not chosen). Mount it with a new `key` each time it opens, so every add gets a fresh
 * form and its own Idempotency-Key (kept for retries of that add). The contact details are
 * personal data: they only go to the API, never into URLs, toasts or logs.
 */
export function CompanyFormDialog({
  open,
  onOpenChange,
  company,
}: CompanyFormDialogProps) {
  const t = useTranslations("Companies");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);

  const schema = useMemo(() => {
    const shortText = (required: string, tooLong: string) =>
      z.string().trim().min(1, required).max(NAME_MAX, tooLong);
    return z.object({
      name: shortText(t("nameRequired"), t("nameTooLong")),
      contact_name: shortText(
        t("contactNameRequired"),
        t("contactNameTooLong"),
      ),
      contact_phone: z
        .string()
        .trim()
        .max(PHONE_TYPED_MAX, t("phoneInvalid"))
        .refine((value) => mobileE164(value) !== null, t("phoneInvalid")),
      contact_email: z
        .string()
        .trim()
        .max(EMAIL_MAX, t("emailTooLong"))
        .regex(EMAIL, t("emailInvalid")),
      notes: z.string().trim().max(NOTES_MAX, t("notesTooLong")),
    });
  }, [t]);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? "",
      contact_name: company?.contact_name ?? "",
      contact_phone: company?.contact_phone ?? "",
      contact_email: company?.contact_email ?? "",
      notes: company?.notes ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      if (company) {
        const change: CompanyUpdate = {};
        if (values.name !== company.name) change.name = values.name;
        if (values.contact_name !== company.contact_name) {
          change.contact_name = values.contact_name;
        }
        // The same number or address written another way is no change.
        if (mobileE164(values.contact_phone) !== company.contact_phone) {
          change.contact_phone = values.contact_phone;
        }
        if (values.contact_email.toLowerCase() !== company.contact_email) {
          change.contact_email = values.contact_email;
        }
        // Empty notes clear them.
        if (values.notes !== (company.notes ?? "")) change.notes = values.notes;
        if (Object.keys(change).length > 0) {
          const saved = await update.mutateAsync({ id: company.id, change });
          showSuccessToast(t("savedToast", { name: saved.name }));
        }
      } else {
        const body: CompanyCreate = {
          name: values.name,
          contact_name: values.contact_name,
          contact_phone: values.contact_phone,
          contact_email: values.contact_email,
        };
        if (values.notes) body.notes = values.notes;
        const added = await create.mutateAsync({
          company: body,
          idempotencyKey,
        });
        showSuccessToast(t("addedToast", { name: added.name }));
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "COMPANY_NAME_TAKEN") {
        setError("name", { message: tErrors("COMPANY_NAME_TAKEN") });
        setFocus("name");
        return;
      }
      const onFields = fieldMessages(error);
      const failed = fields.filter((field) => onFields[field]);
      const [first] = failed;
      if (first) {
        for (const field of failed) {
          setError(field, { message: onFields[field] });
        }
        setFocus(first);
        return;
      }
      setProblem(error);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted while being edited: its detail shows that once the form closes.
        if (
          !next &&
          company &&
          problem instanceof ApiError &&
          problem.status === 404
        ) {
          refetchCompany(queryClient, company.id);
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
          <DialogTitle>
            {company ? t("editTitle", { name: company.name }) : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
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
            id="company-name"
            label={t("nameLabel")}
            error={errors.name}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={NAME_MAX}
                autoComplete="organization"
                {...register("name")}
              />
            )}
          </FormField>
          <FormField
            id="company-contact-name"
            label={t("contactNameLabel")}
            error={errors.contact_name}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={NAME_MAX}
                autoComplete="off"
                {...register("contact_name")}
              />
            )}
          </FormField>
          <FormField
            id="company-contact-phone"
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
          <FormField
            id="company-contact-email"
            label={t("contactEmailLabel")}
            error={errors.contact_email}
          >
            {(aria) => (
              <Input
                {...aria}
                type="email"
                maxLength={EMAIL_MAX}
                autoComplete="off"
                {...register("contact_email")}
              />
            )}
          </FormField>
          <FormField
            id="company-notes"
            label={t("notesLabel")}
            hint={t("notesHint")}
            error={errors.notes}
          >
            {(aria) => (
              <Textarea
                {...aria}
                maxLength={NOTES_MAX}
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
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled field with an optional hint and its error, both linked by aria-describedby. */
function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: FieldError;
  children: (aria: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": described || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-meta text-muted">
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
