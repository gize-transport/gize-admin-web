"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DetailFrame,
  DetailHeading,
  Fact,
  Facts,
  type DetailLayout,
} from "@/components/detail/detail-frame";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { refetchRider, useDeleteRider, useRider } from "./queries";
import { RiderFormDialog } from "./rider-form-dialog";
import {
  planLabel,
  riderTypeLabel,
  SeatPill,
  todayInAddis,
  useSeatDates,
} from "./rider-labels";

type RiderRead = components["schemas"]["RiderRead"];
type SeatRef = components["schemas"]["SeatRef"];

const linkClass = "font-semibold text-royal underline-offset-4 hover:underline";

type RiderDetailProps = {
  riderId: string;
  /** Its own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  onClose?: () => void;
  /** After the rider is deleted: the page goes back to the list, the panel closes. */
  onDeleted?: () => void;
};

/**
 * A rider's details (design-system.md, "Detail panel / page"): who they are, the phone in full
 * (personal data: only here, never in the list, URLs or toasts), where they board and go, their
 * plan and seat. Staff correct them; admins delete them.
 */
export function RiderDetail({
  riderId,
  variant,
  onClose,
  onDeleted,
}: RiderDetailProps) {
  const t = useTranslations("Riders");
  const rider = useRider(riderId);
  return (
    <DetailFrame
      recordId={riderId}
      query={rider}
      variant={variant}
      listHref="/riders"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => (
        <Loaded rider={data} layout={layout} onDeleted={onDeleted} />
      )}
    </DetailFrame>
  );
}

function Loaded({
  rider,
  layout: { variant, headingId, SectionHeading, backLink },
  onDeleted,
}: {
  rider: RiderRead;
  layout: DetailLayout;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Riders");
  const { date } = useTimestampFormat();
  const uid = useId();
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Delete shows for admins only; the API still refuses others.
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const sectionHeading = "font-display text-section font-semibold text-navy";
  const plan = planLabel(rider, t);

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <DetailHeading id={headingId} variant={variant}>
            {rider.full_name}
          </DetailHeading>
        </div>
        <p className="text-table text-muted">
          {rider.company
            ? t("typeCompanyAt", { company: rider.company.name })
            : riderTypeLabel(rider.rider_type, t)}
        </p>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("phone")}>
          {rider.phone ? (
            <span className="font-mono">{rider.phone}</span>
          ) : (
            <span className="text-muted">{t("notSet")}</span>
          )}
        </Fact>
        {rider.company && (
          <Fact label={t("company")}>
            <Link href={`/companies/${rider.company.id}`} className={linkClass}>
              {rider.company.name}
            </Link>
          </Fact>
        )}
        <Fact label={t("boardsAt")}>
          {rider.home_area?.name ?? (
            <span className="text-muted">{t("notSet")}</span>
          )}
        </Fact>
        {rider.rider_type !== "corporate" && (
          <Fact label={t("goesTo")}>
            {rider.destination_area?.name ?? (
              <span className="text-muted">{t("notSet")}</span>
            )}
          </Fact>
        )}
        <Fact label={t("plan")}>
          {plan ?? (
            <span className="text-muted">
              {t(rider.rider_type === "corporate" ? "planCompany" : "notSet")}
            </span>
          )}
        </Fact>
        <Fact label={t("openRequests")}>
          <span className="tabular-nums">{rider.open_requests}</span>
        </Fact>
        <Fact label={t("source")}>
          {t(rider.source === "app" ? "sourceApp" : "sourceStaff")}
        </Fact>
        <Fact label={t("since")}>{date(rider.created_at)}</Fact>
      </Facts>

      <section className="grid gap-3">
        <SectionHeading className={sectionHeading}>{t("seat")}</SectionHeading>
        {rider.seat ? (
          <div className="grid gap-3">
            <SeatLine seat={rider.seat} />
            {rider.next_seat && (
              <div className="grid gap-1">
                <p className="text-table font-semibold text-ink">
                  {t("nextSeat")}
                </p>
                <SeatLine seat={rider.next_seat} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-body text-muted">{t("noSeatDetail")}</p>
        )}
      </section>

      <section className="grid gap-4 border-t border-line pt-5">
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => {
            setFormKey((key) => (key ?? 0) + 1);
            setFormOpen(true);
          }}
        >
          {t("edit")}
        </Button>
        {isAdmin && (
          <div className="grid gap-2 border-t border-line pt-4">
            <SectionHeading className="text-table font-semibold text-danger">
              {t("deleteSection")}
            </SectionHeading>
            {rider.seat && (
              <p id={`${uid}-delete-seat`} className="text-table text-muted">
                {t("deleteHasSeat", { code: rider.seat.route_code })}
              </p>
            )}
            <Button
              variant="destructive"
              className="w-fit"
              aria-describedby={rider.seat ? `${uid}-delete-seat` : undefined}
              onClick={() => setDeleting(true)}
            >
              {t("deleteRider")}
            </Button>
          </div>
        )}
      </section>

      <DeleteRiderDialog
        rider={rider}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={onDeleted}
      />
      {formKey !== null && (
        <RiderFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          rider={rider}
        />
      )}
    </>
  );
}

/** One seat: its route (a link), riding or reserved, and when it starts or ends. */
function SeatLine({ seat }: { seat: SeatRef }) {
  const t = useTranslations("Riders");
  const seatDates = useSeatDates();
  const dates = seatDates(seat, todayInAddis());
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/routes/${seat.route_id}`}
          className={`font-mono ${linkClass}`}
          aria-label={t("seatRouteLink", { code: seat.route_code })}
        >
          {seat.route_code}
        </Link>
        <SeatPill seat={seat} />
      </div>
      {dates && <p className="text-table text-muted">{dates}</p>}
    </div>
  );
}

/** Admin delete, confirmed. Refused while they hold a seat (`RIDER_HAS_SEAT`). */
function DeleteRiderDialog({
  rider,
  open,
  onClose,
  onDeleted,
}: {
  rider: RiderRead;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Riders");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteRider();
  const error = remove.error;
  const waiting = useRetryWait(error);
  const hasSeat = error instanceof ApiError && error.code === "RIDER_HAS_SEAT";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Gone already (deleted meanwhile): its detail shows that once the dialog closes.
        if (error instanceof ApiError && error.status === 404) {
          refetchRider(queryClient, rider.id);
        }
        // The next time it opens, it starts without this attempt's error.
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle")}
      description={t("deleteDescription", { name: rider.full_name })}
      confirmLabel={t("deleteRider")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting || hasSeat}
      onConfirm={() =>
        remove.mutate(rider.id, {
          onSuccess: () => {
            showSuccessToast(t("deleted"));
            onClose();
            onDeleted?.();
          },
        })
      }
    >
      {error && (
        <ProblemAlert
          message={hasSeat ? t("deleteRefusedSeat") : message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
