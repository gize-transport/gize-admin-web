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
import { StatusPill } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteStatusPill } from "@/features/routes/route-status-pill";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { CompanyFormDialog } from "./company-form-dialog";
import {
  companyKeys,
  refetchCompany,
  useCompany,
  useCompanyRoutes,
  useDeleteCompany,
  useUpdateCompany,
} from "./queries";

type CompanyRead = components["schemas"]["CompanyRead"];

type CompanyDetailProps = {
  companyId: string;
  /** Its own page (h1, a link back) or the list's side panel (h2, a close button). */
  variant: "page" | "panel";
  /** Closes the side panel. */
  onClose?: () => void;
  /** After the company is deleted: the page goes back to the list, the panel closes. */
  onDeleted?: () => void;
};

/**
 * A company's details (design-system.md, "Detail panel / page"): key facts, its routes, and the
 * actions at the bottom with Delete set apart. The same content is a page and a side panel.
 */
export function CompanyDetail({
  companyId,
  variant,
  onClose,
  onDeleted,
}: CompanyDetailProps) {
  const t = useTranslations("Companies");
  const company = useCompany(companyId);
  return (
    <DetailFrame
      query={company}
      variant={variant}
      listHref="/companies"
      labels={{
        backToList: t("backToList"),
        close: t("closeDetail"),
        notFoundTitle: t("notFoundTitle"),
        notFoundDescription: t("notFoundDescription"),
      }}
      onClose={onClose}
    >
      {(data, layout) => (
        <Loaded company={data} layout={layout} onDeleted={onDeleted} />
      )}
    </DetailFrame>
  );
}

function Loaded({
  company,
  layout: { variant, headingId, SectionHeading, backLink },
  onDeleted,
}: {
  company: CompanyRead;
  layout: DetailLayout;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Companies");
  const { date } = useTimestampFormat();
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const update = useUpdateCompany();
  // After a 429, Reactivate stays disabled until Retry-After has passed.
  const reactivateWaiting = useRetryWait(update.error);
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<"deactivate" | "delete" | null>(null);

  function reactivate() {
    update.mutate(
      { id: company.id, change: { is_active: true } },
      {
        onSuccess: (saved) =>
          showSuccessToast(t("reactivated", { name: saved.name })),
      },
    );
  }

  const status = company.is_active ? (
    <StatusPill tone="success">{t("active")}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{t("inactive")}</StatusPill>
  );

  return (
    <>
      <div className="grid gap-2">
        {backLink}
        <DetailHeading id={headingId} variant={variant}>
          {company.name}
        </DetailHeading>
      </div>

      <Facts label={t("detailLabel")} variant={variant}>
        <Fact label={t("contactName")}>{company.contact_name}</Fact>
        <Fact label={t("contactPhone")}>
          <span className="font-mono">{company.contact_phone}</span>
        </Fact>
        <Fact label={t("contactEmail")}>
          <span className="break-all">{company.contact_email}</span>
        </Fact>
        <Fact label={t("billing")}>{t("billingPostpaid")}</Fact>
        <Fact label={t("status")}>{status}</Fact>
        <Fact label={t("added")}>{date(company.created_at)}</Fact>
        <Fact label={t("notes")} wide>
          {company.notes ? (
            <span className="whitespace-pre-line">{company.notes}</span>
          ) : (
            <span className="text-muted">{t("noNotes")}</span>
          )}
        </Fact>
      </Facts>

      <section className="grid gap-3">
        <SectionHeading className="font-display text-section font-semibold text-navy">
          {t("routesTitle")}
        </SectionHeading>
        <CompanyRoutes company={company} />
      </section>

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
          {company.is_active ? (
            <Button
              variant="secondary"
              onClick={() => setConfirm("deactivate")}
            >
              {t("deactivate")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              pending={update.isPending}
              aria-disabled={reactivateWaiting || undefined}
              onClick={reactivate}
            >
              {t("reactivate")}
            </Button>
          )}
        </div>
        {/* A failed reactivation (deactivation shows its errors in its dialog). */}
        {!company.is_active && update.error && (
          <MutationProblem error={update.error} />
        )}
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
        <CompanyFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          company={company}
        />
      )}
      <DeactivateDialog
        company={company}
        open={confirm === "deactivate"}
        onClose={() => setConfirm(null)}
      />
      <DeleteDialog
        company={company}
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onDeleted={onDeleted}
      />
    </>
  );
}

function MutationProblem({ error }: { error: unknown }) {
  const { message } = useApiErrorMessages();
  return (
    <ProblemAlert
      message={message(error)}
      requestId={error instanceof ApiError ? error.requestId : null}
      retryAfterSeconds={
        error instanceof ApiError ? error.retryAfterSeconds : null
      }
    />
  );
}

function CompanyRoutes({ company }: { company: CompanyRead }) {
  const t = useTranslations("Companies");
  const { message } = useApiErrorMessages();
  const routes = useCompanyRoutes(company.id);

  if (routes.isPending) return <Skeleton className="h-20 w-full" />;
  if (routes.isError) {
    return (
      <ProblemAlert
        message={message(routes.error)}
        requestId={
          routes.error instanceof ApiError ? routes.error.requestId : null
        }
        retryAfterSeconds={
          routes.error instanceof ApiError
            ? routes.error.retryAfterSeconds
            : null
        }
        onRetry={() => void routes.refetch()}
      />
    );
  }
  if (routes.data.items.length === 0) {
    return <p className="text-body text-muted">{t("noRoutes")}</p>;
  }
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl ring-1 ring-line">
        <Table>
          <TableCaption className="sr-only">
            {t("routesLabel", { name: company.name })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("routeCode")}</TableHead>
              <TableHead>{t("routeCorridor")}</TableHead>
              <TableHead>{t("routeStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.data.items.map((route) => (
              <TableRow key={route.id}>
                <TableCell className="font-mono">
                  <Link
                    href={`/routes/${route.id}`}
                    className="font-semibold text-royal underline-offset-4 hover:underline"
                  >
                    {route.code}
                  </Link>
                </TableCell>
                <TableCell>
                  {t.rich("routeCorridorName", {
                    origin: route.corridor.origin_area.name,
                    destination: route.corridor.destination_area.name,
                    spoken: (chunks) => (
                      <span className="sr-only">{chunks}</span>
                    ),
                    arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
                  })}
                </TableCell>
                <TableCell>
                  <RouteStatusPill route={route} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {routes.data.next_cursor !== null && (
        <p className="text-meta text-muted">
          {t("moreRoutes", { count: routes.data.items.length })}
        </p>
      )}
    </div>
  );
}

function DeactivateDialog({
  company,
  open,
  onClose,
}: {
  company: CompanyRead;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Companies");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const update = useUpdateCompany();
  const error = update.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchCompany(queryClient, company.id);
        }
        // The next time it opens, it starts without this attempt's error.
        update.reset();
        onClose();
      }}
      title={t("deactivateTitle", { name: company.name })}
      description={t("deactivateDescription")}
      confirmLabel={t("deactivate")}
      pending={update.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        update.mutate(
          { id: company.id, change: { is_active: false } },
          {
            onSuccess: (saved) => {
              showSuccessToast(t("deactivated", { name: saved.name }));
              onClose();
            },
            onError: (failed) => {
              // Refused for a running route: show the routes as they are now.
              if (
                failed instanceof ApiError &&
                failed.code === "COMPANY_IN_USE"
              ) {
                void queryClient.invalidateQueries({
                  queryKey: companyKeys.routes(company.id),
                });
              }
            },
          },
        )
      }
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "COMPANY_IN_USE"
              ? t("inUseDeactivate")
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
  company,
  open,
  onClose,
  onDeleted,
}: {
  company: CompanyRead;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Companies");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteCompany();
  const error = remove.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (error instanceof ApiError && error.status === 404) {
          refetchCompany(queryClient, company.id);
        }
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle", { name: company.name })}
      description={t("deleteDescription")}
      confirmLabel={t("delete")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        remove.mutate(company.id, {
          onSuccess: () => {
            showSuccessToast(t("deleted", { name: company.name }));
            onClose();
            onDeleted?.();
          },
        })
      }
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "COMPANY_IN_USE"
              ? t("inUseDelete")
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
