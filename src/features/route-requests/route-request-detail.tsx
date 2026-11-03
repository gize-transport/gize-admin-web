"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import {
  refetchRequest,
  useDeleteRouteRequest,
  useRouteRequest,
} from "./queries";
import { AskedFor, RequestStatusPill, riderLabel } from "./request-labels";
import { RequestActions } from "./request-actions";
import { RouteRequestFormDialog } from "./route-request-form-dialog";

type RouteRequestRead = components["schemas"]["RouteRequestRead"];

type RouteRequestDetailProps = {
  requestId: string;
  /** Its own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  onClose?: () => void;
  /** After the request is deleted: the page goes back to the list, the panel closes. */
  onDeleted?: () => void;
};

/**
 * A route request's details (design-system.md, "Detail panel / page"): what's asked, the rider,
 * preferred times, the contact (personal data: only here, never in the list, URLs or toasts),
 * where it stands and what can happen next.
 */
export function RouteRequestDetail({
  requestId,
  variant,
  onClose,
  onDeleted,
}: RouteRequestDetailProps) {
  const t = useTranslations("RouteRequests");
  const request = useRouteRequest(requestId);
  return (
    <DetailFrame
      recordId={requestId}
      query={request}
      variant={variant}
      listHref="/route-requests"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => (
        <Loaded request={data} layout={layout} onDeleted={onDeleted} />
      )}
    </DetailFrame>
  );
}

function Loaded({
  request,
  layout: { variant, headingId, SectionHeading, backLink },
  onDeleted,
}: {
  request: RouteRequestRead;
  layout: DetailLayout;
  onDeleted?: () => void;
}) {
  const t = useTranslations("RouteRequests");
  const { date } = useTimestampFormat();
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Delete shows for admins only; the API still refuses others.
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const sectionHeading = "font-display text-section font-semibold text-navy";
  const morning = request.preferred_morning_time;
  const back = request.preferred_return_time;

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <DetailHeading id={headingId} variant={variant}>
            {request.rider_name}
          </DetailHeading>
          <RequestStatusPill request={request} />
        </div>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("asked")}>
          {request.kind === "route" && request.route ? (
            <Link
              href={`/routes/${request.route.id}`}
              className="font-semibold text-royal underline-offset-4 hover:underline"
            >
              <AskedFor request={request} />
            </Link>
          ) : (
            <AskedFor request={request} />
          )}
        </Fact>
        <Fact label={t("kind")}>
          {t(request.kind === "route" ? "kindRoute" : "kindNewAreas")}
        </Fact>
        <Fact label={t("rider")}>{riderLabel(request, t)}</Fact>
        <Fact label={t("preferredTimes")}>
          {morning !== null && back !== null
            ? t("timesBoth", { morning, back })
            : morning !== null
              ? t("timesMorning", { morning })
              : back !== null
                ? t("timesReturn", { back })
                : t("noTimes")}
        </Fact>
        <Fact label={t("contactName")}>{request.contact_name}</Fact>
        <Fact label={t("contactPhone")}>
          <span className="font-mono">{request.contact_phone}</span>
        </Fact>
        {request.matched_route !== null && (
          <Fact label={t("matchedRoute")}>
            <Link
              href={`/routes/${request.matched_route.id}`}
              className="font-mono font-semibold text-royal underline-offset-4 hover:underline"
            >
              {request.matched_route.code}
            </Link>
          </Fact>
        )}
        {request.decline_reason !== null && (
          <Fact label={t("declineReason")}>{request.decline_reason}</Fact>
        )}
        <Fact label={t("source")}>
          {t(request.source === "app" ? "sourceApp" : "sourceStaff")}
        </Fact>
        <Fact label={t("recorded")}>{date(request.created_at)}</Fact>
        <Fact label={t("notes")} wide>
          {request.notes ? (
            <span className="whitespace-pre-line">{request.notes}</span>
          ) : (
            <span className="text-muted">{t("noNotes")}</span>
          )}
        </Fact>
      </Facts>

      <section className="grid gap-3">
        <SectionHeading className={sectionHeading}>
          {t("nextSteps")}
        </SectionHeading>
        <RequestActions request={request} />
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
            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => setDeleting(true)}
            >
              {t("deleteRequest")}
            </Button>
          </div>
        )}
      </section>

      <DeleteRequestDialog
        request={request}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={onDeleted}
      />
      {formKey !== null && (
        <RouteRequestFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          request={request}
        />
      )}
    </>
  );
}

/** Admin delete, confirmed: for a request recorded by mistake (declining says no). */
function DeleteRequestDialog({
  request,
  open,
  onClose,
  onDeleted,
}: {
  request: RouteRequestRead;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("RouteRequests");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteRouteRequest();
  const error = remove.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Gone already (deleted meanwhile): its detail shows that once the dialog closes.
        if (error instanceof ApiError && error.status === 404) {
          refetchRequest(queryClient, request.id);
        }
        // The next time it opens, it starts without this attempt's error.
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle")}
      description={t("deleteDescription")}
      confirmLabel={t("deleteRequest")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        remove.mutate(request.id, {
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
          message={message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
    </ConfirmDialog>
  );
}
