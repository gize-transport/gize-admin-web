"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PowerOffIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ActionsMenu,
  ActionsMenuItem,
  CopyLinkItem,
} from "@/components/detail/actions-menu";
import { DetailHeader } from "@/components/detail/detail-header";
import {
  DetailFrame,
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
  layout,
}: {
  member: StaffRead;
  layout: DetailLayout;
}) {
  const t = useTranslations("Staff");
  const { variant } = layout;
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
  const menuButton = useRef<HTMLButtonElement>(null);

  function reactivate() {
    update.mutate(
      { id: member.id, change: { is_active: true } },
      {
        onSuccess: () => {
          showSuccessToast(t("reactivated"));
          // Reactivate goes away with the change: focus moves to the actions beside it.
          menuButton.current?.focus();
        },
      },
    );
  }

  return (
    <>
      <DetailHeader
        layout={layout}
        title={member.full_name}
        status={<StaffStatusPill member={member} />}
        note={isMe && <span className="text-meta text-muted">{t("you")}</span>}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setNameKey((key) => (key ?? 0) + 1);
                setNameOpen(true);
              }}
            >
              <PencilIcon aria-hidden />
              {t("editName")}
            </Button>
            {/* The likely next step for a deactivated member, so not hidden in the menu. */}
            {!member.is_active && (
              <Button
                variant="secondary"
                pending={update.isPending}
                aria-disabled={reactivateWaiting || undefined}
                onClick={reactivate}
              >
                {t("reactivate")}
              </Button>
            )}
          </>
        }
        menu={
          <ActionsMenu name={member.full_name} ref={menuButton}>
            <ActionsMenuItem
              icon={<ShieldIcon aria-hidden />}
              onSelect={() => setConfirm({ kind: "role", member })}
            >
              {t(member.role === "admin" ? "makeStaff" : "makeAdmin")}
            </ActionsMenuItem>
            {member.is_active && (
              <ActionsMenuItem
                icon={<PowerOffIcon aria-hidden />}
                onSelect={() => setConfirm({ kind: "deactivate", member })}
              >
                {t("deactivate")}
              </ActionsMenuItem>
            )}
            <CopyLinkItem path={`/staff/${member.id}`} />
          </ActionsMenu>
        }
      />
      {/* A failed reactivation (the other changes show their errors in their dialogs). */}
      {!member.is_active && update.error && (
        <UpdateProblem error={update.error} />
      )}

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
}: {
  member: StaffRead;
  isMe: boolean;
  onClose: () => void;
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
