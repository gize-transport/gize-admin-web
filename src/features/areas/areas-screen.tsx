"use client";

import { MapPinIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { IconAvatar } from "@/components/avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  ListToolbar,
  NameSortMenu,
  RowAction,
  useListParams,
  useListSort,
} from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { SearchField } from "@/components/search-field";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { AreaFormDialog } from "./area-form-dialog";
import { useAreas, useDeleteArea, AREA_SORTS } from "./queries";

type AreaRead = components["schemas"]["AreaRead"];

const col = createDataTableColumnHelper<AreaRead>();

type FormState = { key: number; area?: AreaRead } | null;

/** Areas (GZW-026): list with search, add and rename for staff, delete for admins. */
export function AreasScreen() {
  const t = useTranslations("Areas");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const { cursor, get, setFilter } = useListParams();
  const q = get("q");
  const sort = useListSort(AREA_SORTS);
  const areas = useAreas({ q, sort, cursor });
  // Delete shows for admins only; the API still refuses others.
  const isAdmin = useCurrentStaff().data?.role === "admin";

  const [form, setForm] = useState<FormState>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AreaRead | null>(null);

  function openForm(area?: AreaRead) {
    setForm((previous) => ({ key: (previous?.key ?? 0) + 1, area }));
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: t("colName"),
          cell: (info) => (
            <CellWithPicture picture={<IconAvatar icon={MapPinIcon} />}>
              <RowAction
                onSelect={() => openForm(info.row.original)}
                aria-label={t("renameLabel", { name: info.getValue() })}
              >
                {info.getValue()}
              </RowAction>
            </CellWithPicture>
          ),
        }),
        col.accessor("created_at", {
          header: t("colAdded"),
          cell: (info) => date(info.getValue()),
        }),
        ...(isAdmin
          ? [
              col.display({
                id: "actions",
                header: () => (
                  <span className="sr-only">{t("colActions")}</span>
                ),
                cell: (info) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-soft"
                    aria-label={t("deleteLabel", {
                      name: info.row.original.name,
                    })}
                    onClick={() => setDeleting(info.row.original)}
                  >
                    {t("delete")}
                  </Button>
                ),
              }),
            ]
          : []),
      ]),
    [t, date, isAdmin],
  );

  const addButton = (
    <Button onClick={() => openForm()}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  if (isForbidden(areas.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <DataTable
        toolbar={
          <ListToolbar action={addButton}>
            <SearchField
              param="q"
              label={t("searchLabel")}
              placeholder={t("searchHint")}
            />
            <NameSortMenu />
          </ListToolbar>
        }
        label={t("tableLabel")}
        columns={columns}
        data={areas.data?.items}
        getRowId={(area) => area.id}
        isLoading={areas.isPending}
        nextCursor={areas.data?.next_cursor ?? null}
        error={
          areas.isError ? (
            <ProblemAlert
              message={message(areas.error)}
              requestId={
                areas.error instanceof ApiError ? areas.error.requestId : null
              }
              retryAfterSeconds={
                areas.error instanceof ApiError
                  ? areas.error.retryAfterSeconds
                  : null
              }
              onRetry={() => void areas.refetch()}
            />
          ) : undefined
        }
        emptyState={
          q ? (
            <EmptyState
              icon={<MapPinIcon aria-hidden />}
              title={t("noMatchesTitle", { q })}
              description={t("noMatchesDescription")}
              action={
                <Button
                  variant="secondary"
                  onClick={() => setFilter("q", null)}
                >
                  {t("clearSearch")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<MapPinIcon aria-hidden />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={addButton}
            />
          )
        }
      />

      {form && (
        <AreaFormDialog
          key={form.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          area={form.area}
        />
      )}
      <DeleteAreaDialog area={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function DeleteAreaDialog({
  area,
  onClose,
}: {
  area: AreaRead | null;
  onClose: () => void;
}) {
  const t = useTranslations("Areas");
  const { message } = useApiErrorMessages();
  const remove = useDeleteArea();
  // The last area shown, so the text doesn't change while the dialog closes.
  const [shown, setShown] = useState(area);
  if (area && area !== shown) setShown(area);

  const error = remove.error;
  const waiting = useRetryWait(error);
  return (
    <ConfirmDialog
      open={area !== null}
      onOpenChange={(open) => {
        if (open) return;
        // The next time it opens, it starts without this attempt's error.
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle", { name: shown?.name ?? "" })}
      description={t("deleteDescription")}
      confirmLabel={t("delete")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() => {
        if (!area) return;
        remove.mutate(area.id, {
          onSuccess: () => {
            showSuccessToast(t("deleted", { name: area.name }));
            onClose();
          },
        });
      }}
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "AREA_IN_USE"
              ? t("inUse")
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
