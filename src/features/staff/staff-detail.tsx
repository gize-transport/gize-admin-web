"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DetailFrame,
  DetailHeading,
  Fact,
  Facts,
  type DetailLayout,
} from "@/components/detail/detail-frame";
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
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { returnFocus } from "@/lib/focus";
import { useTimestampFormat } from "@/lib/time";
import { refetchStaffMember, useStaffMember, useUpdateStaff } from "./queries";
import { staffStatus, StaffStatusPill } from "./staff-status";

type StaffRead = components["schemas"]["StaffRead"];

// The contract's limit (StaffUpdate.full_name).
const NAME_MAX = 200;

type StaffDetailProps = {
  staffId: string;
  /** Their own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  onClose?: () => void;
};

/**
 * A staff member's details (GZW-060, admins): email, role, status and first sign-in; admins
 * correct the name, change the role, deactivate or reactivate. The API refuses a change that
 * would leave no active admin who has signed in (`LAST_ACTIVE_ADMIN`).
 */
export function StaffDetail({ staffId, variant, onClose }: StaffDetailProps) {
  const t = useTranslations("Staff");
  const member = useStaffMember(staffId);
  return (
    <DetailFrame
      recordId={staffId}
      query={member}
      variant={variant}
      listHref="/staff"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => <Loaded member={data} layout={layout} />}
    </DetailFrame>
  );
}

type Confirm = "role" | "deactivate";

function Loaded({
  member,
  layout: { variant, headingId, backLink },
}: {
  member: StaffRead;
  layout: DetailLayout;
}) {
  const t = useTranslations("Staff");
  const { dateTime, date } = useTimestampFormat();
  const isMe = useCurrentStaff().data?.id === member.id;
  const update = useUpdateStaff();
  const reactivateWaiting = useRetryWait(update.error);
  // The member as the confirmation opened with them: the change it confirms stays the one shown.
  const [confirm, setConfirm] = useState<{
    kind: Confirm;
    member: StaffRead;
  } | null>(null);
  const [nameKey, setNameKey] = useState<number | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const status = staffStatus(member);
  // Just deactivated: the same button now says Reactivate under the user's focus; a repeated
  // key press from the confirmation mustn't undo it unconfirmed.
  const deactivatedAt = useRef(0);

  function reactivate() {
    if (Date.now() - deactivatedAt.current < 800) return;
    update.mutate(
      { id: member.id, change: { is_active: true } },
      { onSuccess: () => showSuccessToast(t("reactivated")) },
    );
  }

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <DetailHeading id={headingId} variant={variant}>
            {member.full_name}
          </DetailHeading>
          <StaffStatusPill member={member} />
          {isMe && <span className="text-meta text-muted">{t("you")}</span>}
        </div>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("email")}>{member.email}</Fact>
        <Fact label={t("role")}>
          {t(member.role === "admin" ? "roleAdmin" : "roleStaff")}
        </Fact>
        <Fact label={t("status")}>
          <span className="grid gap-0.5">
            <span>
              {t(
                status === "active"
                  ? "statusActive"
                  : status === "pending"
                    ? "statusPending"
                    : "statusDeactivated",
              )}
            </span>
            {status !== "active" && (
              <span className="text-table text-muted">
                {t(
                  status === "pending"
                    ? "statusPendingNote"
                    : "statusDeactivatedNote",
                )}
              </span>
            )}
          </span>
        </Fact>
        <Fact label={t("firstSignedIn")}>
          {member.first_signed_in_at === null
            ? t("notYet")
            : dateTime(member.first_signed_in_at)}
        </Fact>
        <Fact label={t("added")}>{date(member.created_at)}</Fact>
      </Facts>

      <section className="grid gap-4 border-t border-line pt-5">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setNameKey((key) => (key ?? 0) + 1);
              setNameOpen(true);
            }}
          >
            {t("editName")}
          </Button>
          {/* One button each (its words change): it stays the same element, so focus can
              return to it after the change. */}
          <Button
            variant="secondary"
            onClick={() => setConfirm({ kind: "role", member })}
          >
            {t(member.role === "admin" ? "makeStaff" : "makeAdmin")}
          </Button>
          <Button
            variant="secondary"
            pending={!member.is_active && update.isPending}
            aria-disabled={
              (!member.is_active && reactivateWaiting) || undefined
            }
            onClick={() =>
              member.is_active
                ? setConfirm({ kind: "deactivate", member })
                : reactivate()
            }
          >
            {t(member.is_active ? "deactivate" : "reactivate")}
          </Button>
        </div>
        {/* A failed reactivation (the other changes show their errors in their dialogs). */}
        {!member.is_active && update.error && (
          <UpdateProblem error={update.error} />
        )}
      </section>

      {confirm?.kind === "role" && (
        <RoleDialog
          member={confirm.member}
          isMe={isMe}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "deactivate" && (
        <DeactivateDialog
          member={confirm.member}
          isMe={isMe}
          onClose={() => setConfirm(null)}
          onDeactivated={() => {
            deactivatedAt.current = Date.now();
          }}
        />
      )}
      {nameKey !== null && (
        <NameDialog
          key={nameKey}
          open={nameOpen}
          onOpenChange={setNameOpen}
          member={member}
        />
      )}
    </>
  );
}

function useUpdateMessage() {
  const t = useTranslations("Staff");
  const { message } = useApiErrorMessages();
  return (error: unknown) =>
    error instanceof ApiError && error.code === "LAST_ACTIVE_ADMIN"
      ? t("lastAdmin")
      : message(error);
}

function UpdateProblem({ error }: { error: unknown }) {
  const words = useUpdateMessage();
  return (
    <ProblemAlert
      message={words(error)}
      requestId={error instanceof ApiError ? error.requestId : null}
      retryAfterSeconds={
        error instanceof ApiError ? error.retryAfterSeconds : null
      }
    />
  );
}

/** Admin ⇄ staff, confirmed; demoting yourself says you lose the admin tools at once. */
function RoleDialog({
  member,
  isMe,
  onClose,
}: {
  member: StaffRead;
  isMe: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Staff");
  const router = useRouter();
  const queryClient = useQueryClient();
  const update = useUpdateStaff();
  const error = update.error;
  const waiting = useRetryWait(error);
  const toStaff = member.role === "admin";
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchStaffMember(queryClient, member.id);
        }
        onClose();
      }}
      title={t(toStaff ? "makeStaffTitle" : "makeAdminTitle", {
        name: member.full_name,
      })}
      description={
        <>
          {t(toStaff ? "makeStaffDescription" : "makeAdminDescription")}
          {toStaff && isMe && (
            <strong className="mt-2 block font-semibold text-ink">
              {t("makeStaffSelf")}
            </strong>
          )}
        </>
      }
      confirmLabel={t(toStaff ? "makeStaff" : "makeAdmin")}
      pending={update.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        update.mutate(
          {
            id: member.id,
            change: { role: toStaff ? "staff" : "admin" },
          },
          {
            onSuccess: () => {
              showSuccessToast(t("roleChanged"));
              onClose();
              // No longer an admin: this page is closed to them now; back to the overview.
              if (isMe && toStaff) router.replace("/");
            },
          },
        )
      }
    >
      {error && <UpdateProblem error={error} />}
    </ConfirmDialog>
  );
}

/** Deactivate, confirmed; deactivating yourself says you'll be signed out. */
function DeactivateDialog({
  member,
  isMe,
  onClose,
  onDeactivated,
}: {
  member: StaffRead;
  isMe: boolean;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  const t = useTranslations("Staff");
  const queryClient = useQueryClient();
  const update = useUpdateStaff();
  const error = update.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchStaffMember(queryClient, member.id);
        }
        onClose();
      }}
      title={t("deactivateTitle", { name: member.full_name })}
      description={
        <>
          {t("deactivateDescription")}
          {isMe && (
            <strong className="mt-2 block font-semibold text-ink">
              {t("deactivateSelf")}
            </strong>
          )}
        </>
      }
      confirmLabel={t("deactivate")}
      tone="destructive"
      pending={update.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        update.mutate(
          { id: member.id, change: { is_active: false } },
          {
            onSuccess: () => {
              showSuccessToast(t("deactivated"));
              onDeactivated();
              onClose();
            },
          },
        )
      }
    >
      {error && <UpdateProblem error={error} />}
    </ConfirmDialog>
  );
}

/** Correct the name (GZ-069): trimmed, 1–200 characters; the email can't change. */
function NameDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffRead;
}) {
  const t = useTranslations("Staff");
  const tCommon = useTranslations("Common");
  const uid = useId();
  const { fieldMessages } = useApiErrorMessages();
  const words = useUpdateMessage();
  const queryClient = useQueryClient();
  const update = useUpdateStaff();
  const [problem, setProblem] = useState<unknown>(null);
  const waiting = useRetryWait(problem);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = update.isPending;
  const schema = useMemo(
    () =>
      z.object({
        full_name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(NAME_MAX, t("nameTooLong")),
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
    defaultValues: { full_name: member.full_name },
  });

  const onSubmit = handleSubmit(async ({ full_name }) => {
    setProblem(null);
    try {
      if (full_name !== member.full_name) {
        await update.mutateAsync({ id: member.id, change: { full_name } });
        showSuccessToast(t("nameSaved"));
      }
      onOpenChange(false);
    } catch (error) {
      const onField = fieldMessages(error).full_name;
      if (onField) {
        setError("full_name", { message: onField });
        setFocus("full_name");
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
        if (!next && problem instanceof ApiError && problem.status === 404) {
          refetchStaffMember(queryClient, member.id);
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
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("nameTitle")}</DialogTitle>
          <DialogDescription>{t("nameHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={words(problem)}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
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
