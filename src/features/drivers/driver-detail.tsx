"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DetailFrame,
  DetailHeading,
  Fact,
  Facts,
  type DetailLayout,
} from "@/components/detail/detail-frame";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { DriverFormDialog } from "./driver-form-dialog";
import {
  refetchDriver,
  useDeleteDriver,
  useDriver,
  useUpdateDriver,
} from "./queries";

type DriverRead = components["schemas"]["DriverRead"];

type DriverDetailProps = {
  driverId: string;
  /** Their own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  /** Closes the side panel. */
  onClose?: () => void;
  /** After the driver is deleted: the page goes back to the list, the panel closes. */
  onDeleted?: () => void;
};

/**
 * A driver's details (design-system.md, "Detail panel / page"): their phone, address and plate,
 * and the actions at the bottom with Delete set apart (admins). The same content is a page and a
 * side panel. Toasts never name them (personal data).
 */
export function DriverDetail({
  driverId,
  variant,
  onClose,
  onDeleted,
}: DriverDetailProps) {
  const t = useTranslations("Drivers");
  const driver = useDriver(driverId);
  return (
    <DetailFrame
      query={driver}
      variant={variant}
      listHref="/drivers"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => (
        <Loaded driver={data} layout={layout} onDeleted={onDeleted} />
      )}
    </DetailFrame>
  );
}

function Loaded({
  driver,
  layout: { variant, headingId, SectionHeading, backLink },
  onDeleted,
}: {
  driver: DriverRead;
  layout: DetailLayout;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Drivers");
  const { date } = useTimestampFormat();
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<"status" | "delete" | null>(null);
  // The status move as it was when its button was pressed: kept while the dialog closes, after
  // the driver has changed.
  const [deactivating, setDeactivating] = useState(driver.is_active);

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <DetailHeading id={headingId} variant={variant}>
          {driver.full_name}
        </DetailHeading>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("phone")}>
          <span className="font-mono">{driver.phone}</span>
        </Fact>
        <Fact label={t("plate")}>
          <span className="font-mono">{driver.plate}</span>
        </Fact>
        <Fact label={t("address")} wide>
          <span className="break-words">{driver.address}</span>
        </Fact>
        <Fact label={t("status")}>
          {driver.is_active ? (
            <StatusPill tone="success">{t("active")}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{t("inactive")}</StatusPill>
          )}
        </Fact>
        <Fact label={t("added")}>{date(driver.created_at)}</Fact>
        <Fact label={t("updated")}>{date(driver.updated_at)}</Fact>
      </Facts>

      <section className="grid gap-4 border-t border-line pt-5">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setFormKey((key) => (key ?? 0) + 1);
              setFormOpen(true);
            }}
          >
            {t("edit")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDeactivating(driver.is_active);
              setConfirm("status");
            }}
          >
            {driver.is_active ? t("deactivate") : t("reactivate")}
          </Button>
        </div>
        {isAdmin && (
          <div className="grid gap-2 border-t border-line pt-4">
            <SectionHeading className="text-table font-semibold text-danger">
              {t("dangerZone")}
            </SectionHeading>
            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => setConfirm("delete")}
            >
              {t("delete")}
            </Button>
          </div>
        )}
      </section>

      {formKey !== null && (
        <DriverFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          driver={driver}
        />
      )}
      <StatusDialog
        driver={driver}
        deactivating={deactivating}
        open={confirm === "status"}
        onClose={() => setConfirm(null)}
      />
      <DeleteDialog
        driver={driver}
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onDeleted={onDeleted}
      />
    </>
  );
}

/** Deactivate an active driver, or reactivate an inactive one (`drivers_update`, `is_active`). */
function StatusDialog({
  driver,
  deactivating,
  open,
  onClose,
}: {
  driver: DriverRead;
  /** Deactivate (true) or reactivate (false), as when the dialog opened. */
  deactivating: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Drivers");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const update = useUpdateDriver();
  const error = update.error;
  const waiting = useRetryWait(error);
  const action = deactivating ? t("deactivate") : t("reactivate");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchDriver(queryClient, driver.id);
        }
        // The next time it opens, it starts without this attempt's error.
        update.reset();
        onClose();
      }}
      title={t(deactivating ? "deactivateTitle" : "reactivateTitle", {
        name: driver.full_name,
      })}
      description={t(
        deactivating ? "deactivateDescription" : "reactivateDescription",
      )}
      confirmLabel={action}
      pending={update.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        update.mutate(
          { id: driver.id, change: { is_active: !deactivating } },
          {
            onSuccess: () => {
              showSuccessToast(
                t(deactivating ? "deactivatedToast" : "reactivatedToast"),
              );
              onClose();
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "DRIVER_ASSIGNED"
              ? t("assignedDeactivate")
              : message(error)
          }
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}

function DeleteDialog({
  driver,
  open,
  onClose,
  onDeleted,
}: {
  driver: DriverRead;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Drivers");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteDriver();
  const error = remove.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchDriver(queryClient, driver.id);
        }
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle", { name: driver.full_name })}
      description={t("deleteDescription")}
      confirmLabel={t("delete")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        remove.mutate(driver.id, {
          onSuccess: () => {
            showSuccessToast(t("deletedToast"));
            onClose();
            onDeleted?.();
          },
        })
      }
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "DRIVER_ASSIGNED"
              ? t("assignedDelete")
              : message(error)
          }
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
