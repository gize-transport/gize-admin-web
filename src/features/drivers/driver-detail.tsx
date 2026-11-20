"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PowerOffIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ActionsMenu,
  ActionsMenuItem,
  ActionsMenuSeparator,
  CopyLinkItem,
} from "@/components/detail/actions-menu";
import { DetailHeader } from "@/components/detail/detail-header";
import {
  DetailFrame,
  Fact,
  Facts,
  type DetailLayout,
} from "@/components/detail/detail-frame";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routeKeys, useDriverRoutes } from "@/features/routes/queries";
import { RouteStatusPill } from "@/features/routes/route-status-pill";
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
type DriverRoutes = ReturnType<typeof useDriverRoutes>;

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
  layout,
  onDeleted,
}: {
  driver: DriverRead;
  layout: DetailLayout;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Drivers");
  const { variant } = layout;
  const { date } = useTimestampFormat();
  const isAdmin = useCurrentStaff().data?.role === "admin";
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<"status" | "delete" | null>(null);
  // The status move as it was when its button was pressed: kept while the dialog closes, after
  // the driver has changed.
  const [deactivating, setDeactivating] = useState(driver.is_active);
  const routes = useDriverRoutes(driver.id);
  const menuButton = useRef<HTMLButtonElement>(null);
  function openStatusDialog() {
    setDeactivating(driver.is_active);
    setConfirm("status");
  }

  return (
    <>
      <DetailHeader
        layout={layout}
        title={driver.full_name}
        status={
          driver.is_active ? (
            <StatusPill tone="success">{t("active")}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{t("inactive")}</StatusPill>
          )
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFormKey((key) => (key ?? 0) + 1);
                setFormOpen(true);
              }}
            >
              <PencilIcon aria-hidden />
              {t("edit")}
            </Button>
            {/* The likely next step for an inactive driver, so not hidden in the menu. */}
            {!driver.is_active && (
              <Button variant="secondary" onClick={openStatusDialog}>
                {t("reactivate")}
              </Button>
            )}
          </>
        }
        menu={
          <ActionsMenu name={driver.full_name} ref={menuButton}>
            {driver.is_active && (
              <ActionsMenuItem
                icon={<PowerOffIcon aria-hidden />}
                onSelect={openStatusDialog}
              >
                {t("deactivate")}
              </ActionsMenuItem>
            )}
            <CopyLinkItem path={`/drivers/${driver.id}`} />
            {isAdmin && (
              <>
                <ActionsMenuSeparator />
                <ActionsMenuItem
                  tone="danger"
                  icon={<Trash2Icon aria-hidden />}
                  onSelect={() => setConfirm("delete")}
                >
                  {t("delete")}
                </ActionsMenuItem>
              </>
            )}
          </ActionsMenu>
        }
      />

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
        <Fact label={t("routes")} wide>
          <TheirRoutes routes={routes} />
        </Fact>
        <Fact label={t("added")}>{date(driver.created_at)}</Fact>
        <Fact label={t("updated")}>{date(driver.updated_at)}</Fact>
      </Facts>

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
        routes={routes}
        open={confirm === "status"}
        onClose={() => setConfirm(null)}
        // A reactivation removes its button: focus goes to the actions beside it.
        focusAfterChange={() => menuButton.current}
      />
      <DeleteDialog
        driver={driver}
        routes={routes}
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
  routes,
  open,
  onClose,
  focusAfterChange,
}: {
  driver: DriverRead;
  /** Deactivate (true) or reactivate (false), as when the dialog opened. */
  deactivating: boolean;
  routes: DriverRoutes;
  open: boolean;
  onClose: () => void;
  /** Where focus goes once the change is made (the button that opened it may be gone). */
  focusAfterChange?: () => HTMLElement | null;
}) {
  const t = useTranslations("Drivers");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const update = useUpdateDriver();
  const error = update.error;
  const assigned = useAssignedWords(error, routes, "deactivate");
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
      focusOnClose={() =>
        update.isSuccess ? (focusAfterChange?.() ?? null) : null
      }
      pending={update.isPending}
      confirmDisabled={waiting}
      onConfirm={() =>
        update.mutate(
          { id: driver.id, change: { is_active: !deactivating } },
          {
            onError: (failed) =>
              refetchRoutesOf(queryClient, driver.id, failed),
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
          message={assigned?.words ?? message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
      {assigned && <RouteLinks routes={assigned.routes} />}
    </ConfirmDialog>
  );
}

function DeleteDialog({
  driver,
  routes,
  open,
  onClose,
  onDeleted,
}: {
  driver: DriverRead;
  routes: DriverRoutes;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Drivers");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const remove = useDeleteDriver();
  const error = remove.error;
  const assigned = useAssignedWords(error, routes, "delete");
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
          onError: (failed) => refetchRoutesOf(queryClient, driver.id, failed),
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
          message={assigned?.words ?? message(error)}
          requestId={error instanceof ApiError ? error.requestId : null}
          retryAfterSeconds={
            error instanceof ApiError ? error.retryAfterSeconds : null
          }
        />
      )}
      {assigned && <RouteLinks routes={assigned.routes} />}
    </ConfirmDialog>
  );
}

type RouteLink = { id: string; code: string };

/** A driver's routes in their details: each one's code (its page) and status. */
function TheirRoutes({ routes }: { routes: DriverRoutes }) {
  const t = useTranslations("Drivers");
  if (routes.isPending) {
    return (
      <>
        <span className="sr-only">{t("routesLoading")}</span>
        <Skeleton aria-hidden className="h-5 w-40" />
      </>
    );
  }
  if (routes.isError) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted">{t("routesError")}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void routes.refetch()}
        >
          {t("routesRetry")}
        </Button>
      </span>
    );
  }
  const { items, next_cursor } = routes.data;
  if (items.length === 0) {
    return <span className="text-muted">{t("routesNone")}</span>;
  }
  return (
    <>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((route) => (
          <li key={route.id} className="flex items-center gap-2">
            <Link
              href={`/routes/${route.id}`}
              className="font-mono font-semibold text-royal underline-offset-4 hover:underline"
            >
              {route.code}
            </Link>
            <RouteStatusPill route={route} showProgress={false} />
          </li>
        ))}
      </ul>
      {next_cursor !== null && (
        <span className="mt-1 block text-table text-muted">
          {t("routesFirst", { count: items.length })}
        </span>
      )}
    </>
  );
}

/**
 * After a 409 DRIVER_ASSIGNED, the routes it counts are read again: the refusal names them
 * (GZ-076). A refusal for anything else leaves them.
 */
function refetchRoutesOf(
  queryClient: ReturnType<typeof useQueryClient>,
  driverId: string,
  error: unknown,
) {
  if (error instanceof ApiError && error.code === "DRIVER_ASSIGNED") {
    void queryClient.invalidateQueries({
      queryKey: routeKeys.driver(driverId),
    });
  }
}

/**
 * The words for a 409 DRIVER_ASSIGNED: the routes they drive, by code (read again after it); if
 * none are known (not read, or none left), the refusal without names. null for any other error.
 */
function useAssignedWords(
  error: unknown,
  routes: DriverRoutes,
  action: "deactivate" | "delete",
): { words: string; routes: RouteLink[] } | null {
  const t = useTranslations("Drivers");
  const format = useFormatter();
  if (!(error instanceof ApiError && error.code === "DRIVER_ASSIGNED")) {
    return null;
  }
  // What was read last while it's read again: usually the same routes, so the words don't jump.
  const items = routes.data?.items ?? [];
  if (items.length === 0) {
    return {
      words: t(
        action === "deactivate" ? "assignedDeactivate" : "assignedDelete",
      ),
      routes: [],
    };
  }
  const codes = format.list(
    items.map((route) => route.code),
    { type: "conjunction" },
  );
  return {
    words: t(
      action === "deactivate"
        ? "assignedDeactivateRoutes"
        : "assignedDeleteRoutes",
      { routes: codes, count: items.length },
    ),
    routes: items.map(({ id, code }) => ({ id, code })),
  };
}

/** The routes a refusal names, each a link to change its driver there. */
function RouteLinks({ routes }: { routes: RouteLink[] }) {
  const t = useTranslations("Drivers");
  if (routes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {routes.map((route) => (
        <li key={route.id}>
          <Link
            href={`/routes/${route.id}`}
            className="text-table font-semibold text-royal underline-offset-4 hover:underline"
          >
            {t("openRoute", { code: route.code })}
          </Link>
        </li>
      ))}
    </ul>
  );
}
