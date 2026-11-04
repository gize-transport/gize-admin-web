"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import {
  useInviteStaff,
  useStaffByEmail,
  useUpdateStaff,
  type StaffRole,
} from "./queries";

// The contract's limits and pattern (StaffInvite): the HTML form rule, ASCII, a dot in the domain.
const NAME_MAX = 200;
const EMAIL_MAX = 320;
const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const ROLES: StaffRole[] = ["staff", "admin"];

type StaffRead = components["schemas"]["StaffRead"];

type InviteStaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The member invited (or reactivated instead): the caller opens them. */
  onOpenMember: (id: string) => void;
};

/**
 * Invite someone (GZW-060): email, name and role; Supabase emails them a link to set a
 * password. Mount it with a new `key` each time it opens: every invite has its own
 * Idempotency-Key, kept for its retries (a 503 is safe to retry). An email already on the staff
 * list is refused: a deactivated member with it can be reactivated from here instead (with the
 * role chosen), an active one opened.
 */
export function InviteStaffDialog({
  open,
  onOpenChange,
  onOpenMember,
}: InviteStaffDialogProps) {
  const t = useTranslations("Staff");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const invite = useInviteStaff();
  const reactivate = useUpdateStaff();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  // The email refused as taken: the member with it may be reactivated (or opened) instead.
  const [takenEmail, setTakenEmail] = useState<string | null>(null);
  // Done: the member opens and takes focus itself; the dialog doesn't hand focus back.
  const [done, setDone] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = invite.isPending || reactivate.isPending;
  // After a 429, the button stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  const holder = useStaffByEmail(takenEmail);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .max(EMAIL_MAX, t("emailTooLong"))
          .regex(EMAIL, t("emailInvalid")),
        full_name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(NAME_MAX, t("nameTooLong")),
        role: z.enum(["staff", "admin"]),
      }),
    [t],
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
    defaultValues: { email: "", full_name: "", role: "staff" },
  });
  // A changed email isn't the one refused any more.
  const email = useWatch({ control, name: "email" });
  const role = useWatch({ control, name: "role" });
  const roleName = t(
    role === "admin" ? "roleAdmin" : "roleStaff",
  ).toLowerCase();
  const stillTaken =
    takenEmail !== null && email.trim().toLowerCase() === takenEmail;

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    setTakenEmail(null);
    try {
      const member = await invite.mutateAsync({
        invite: values,
        idempotencyKey,
      });
      showSuccessToast(t("invited"));
      setDone(true);
      onOpenChange(false);
      onOpenMember(member.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === "STAFF_EMAIL_TAKEN") {
        setTakenEmail(values.email.toLowerCase());
        setError("email", { message: t("emailTaken") });
        setFocus("email");
        return;
      }
      const onField = fieldMessages(error);
      const failed = (["email", "full_name", "role"] as const).filter(
        (field) => onField[field],
      );
      const [first] = failed;
      if (first) {
        for (const field of failed) {
          setError(field, { message: onField[field] });
        }
        setFocus(first);
        return;
      }
      setProblem(error);
    }
  });

  /** Back with the role chosen here (not silently their old one). */
  function reactivateInstead(id: string) {
    setProblem(null);
    reactivate.mutate(
      { id, change: { is_active: true, role } },
      {
        onSuccess: () => {
          showSuccessToast(t("reactivated"));
          setDone(true);
          onOpenChange(false);
          onOpenMember(id);
        },
        onError: (error) => setProblem(error),
      },
    );
  }

  let problemWords = "";
  if (problem instanceof ApiError && problem.code === "AUTH_ACCOUNT_EXISTS") {
    problemWords = t("authAccountExists");
  } else if (problem instanceof ApiError && problem.status === 503) {
    problemWords = t("inviteUnavailable");
  } else if (problem !== null) {
    problemWords = message(problem);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
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
          if (done) event.preventDefault();
          else returnFocus(event, returnFocusTo.current);
        }}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={problemWords}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <FormField
            id={`${uid}-staff-email`}
            label={t("emailLabel")}
            hint={t("emailHint")}
            error={errors.email}
          >
            {(aria) => (
              <Input
                {...aria}
                type="email"
                inputMode="email"
                maxLength={EMAIL_MAX}
                autoComplete="off"
                {...register("email")}
              />
            )}
          </FormField>
          {/* Announced as it changes: the lookup answers after focus moved to the email. */}
          <div
            role="status"
            className={stillTaken && holder.isSuccess ? undefined : "sr-only"}
          >
            {stillTaken && holder.isSuccess && (
              <TakenBy
                member={holder.data}
                roleName={roleName}
                pending={reactivate.isPending}
                onReactivate={reactivateInstead}
                onOpen={(id) => {
                  setDone(true);
                  onOpenChange(false);
                  onOpenMember(id);
                }}
              />
            )}
          </div>
          {stillTaken && holder.isError && (
            <ProblemAlert
              message={message(holder.error)}
              requestId={
                holder.error instanceof ApiError ? holder.error.requestId : null
              }
              retryAfterSeconds={
                holder.error instanceof ApiError
                  ? holder.error.retryAfterSeconds
                  : null
              }
              onRetry={() => void holder.refetch()}
            />
          )}
          <FormField
            id={`${uid}-staff-name`}
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
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-table font-semibold text-ink">
              {t("roleLegend")}
            </legend>
            {ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 text-body text-ink"
              >
                <input
                  type="radio"
                  value={role}
                  className="size-4 shrink-0 accent-royal"
                  {...register("role")}
                />
                {t(role === "admin" ? "roleAdminOption" : "roleStaffOption")}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" aria-disabled={pending || undefined}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={invite.isPending}
              aria-disabled={waiting || reactivate.isPending || undefined}
            >
              {t("send")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Who has the email: reactivate a deactivated member, open an active one, or where to look. */
function TakenBy({
  member,
  roleName,
  pending,
  onReactivate,
  onOpen,
}: {
  member: StaffRead | null;
  roleName: string;
  pending: boolean;
  onReactivate: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("Staff");
  if (member === null) {
    return (
      <p className="rounded-lg bg-ice p-4 text-body text-ink">
        {t("emailTakenUnknown")}
      </p>
    );
  }
  return (
    <div className="grid gap-2 rounded-lg bg-ice p-4">
      <p className="text-body text-ink">
        {member.is_active
          ? t("emailTakenActive", { name: member.full_name })
          : t("emailTakenDeactivated", {
              name: member.full_name,
              role: roleName,
            })}
      </p>
      {member.is_active ? (
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => onOpen(member.id)}
        >
          {t("openMember", { name: member.full_name })}
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="w-fit"
          pending={pending}
          onClick={() => onReactivate(member.id)}
        >
          {t("reactivateInstead", { name: member.full_name, role: roleName })}
        </Button>
      )}
    </div>
  );
}
