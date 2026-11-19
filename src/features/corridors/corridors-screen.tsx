"use client";

import { ArrowLeftRightIcon, PlusIcon, RouteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { IconAvatar } from "@/components/avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { AreaPicker } from "@/components/pickers/area-picker";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useArea } from "@/features/areas/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { CorridorFormDialog } from "./corridor-form-dialog";
import { useCorridors, useDeleteCorridor } from "./queries";

type AreaRef = components["schemas"]["AreaRef"];
type CorridorRead = components["schemas"]["CorridorRead"];

const col = createDataTableColumnHelper<CorridorRead>();

const ORIGIN_PARAM = "origin_area_id";
const DESTINATION_PARAM = "destination_area_id";

type FormState = { key: number; corridor?: CorridorRead } | null;

/** Both ends' names, for messages: `{origin} → {destination}`. */
function names(corridor: CorridorRead) {
  return {
    origin: corridor.origin_area.name,
    destination: corridor.destination_area.name,
  };
}

/**
 * Corridors (GZW-020): list filtered by origin and destination area, add and change for staff,
 * delete for admins. A corridor has a direction, so it always shows "origin → destination".
 */
export function CorridorsScreen() {
  const t = useTranslations("Corridors");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const { cursor, get, setFilters } = useListParams();
  const originAreaId = get(ORIGIN_PARAM) || null;
  const destinationAreaId = get(DESTINATION_PARAM) || null;
  const corridors = useCorridors({ originAreaId, destinationAreaId, cursor });
  // Delete shows for admins only; the API still refuses others.
  const isAdmin = useCurrentStaff().data?.role === "admin";

  const [form, setForm] = useState<FormState>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CorridorRead | null>(null);

  function openForm(corridor?: CorridorRead) {
    setForm((previous) => ({ key: (previous?.key ?? 0) + 1, corridor }));
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.display({
          id: "corridor",
          header: t("colCorridor"),
          cell: (info) => (
            // Its name comes from its content: "Edit Bole to Piassa" (the arrow is hidden from
            // screen readers), so the visible text is part of the name (WCAG 2.5.3).
            <CellWithPicture picture={<IconAvatar icon={ArrowLeftRightIcon} />}>
              <RowAction onSelect={() => openForm(info.row.original)}>
                {t.rich("rowName", {
                  ...names(info.row.original),
                  spoken: (chunks) => <span className="sr-only">{chunks}</span>,
                  arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
                })}
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
                    aria-label={t("deleteLabel", names(info.row.original))}
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

  if (isForbidden(corridors.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered = originAreaId !== null || destinationAreaId !== null;
  // A filter the API can't read (a hand-edited address): nothing matches, offer to clear it.
  const badFilter =
    filtered &&
    corridors.error instanceof ApiError &&
    corridors.error.code === "VALIDATION_FAILED";
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={addButton}
      />
      <DataTable
        toolbar={
          <div
            role="group"
            aria-label={t("filtersLabel")}
            className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl"
          >
            <AreaFilter param={ORIGIN_PARAM} label={t("originLabel")} />
            <AreaFilter
              param={DESTINATION_PARAM}
              label={t("destinationLabel")}
            />
          </div>
        }
        label={t("tableLabel")}
        columns={columns}
        data={badFilter ? [] : corridors.data?.items}
        getRowId={(corridor) => corridor.id}
        isLoading={corridors.isPending}
        nextCursor={corridors.data?.next_cursor ?? null}
        error={
          corridors.isError && !badFilter ? (
            <ProblemAlert
              message={message(corridors.error)}
              requestId={
                corridors.error instanceof ApiError
                  ? corridors.error.requestId
                  : null
              }
              retryAfterSeconds={
                corridors.error instanceof ApiError
                  ? corridors.error.retryAfterSeconds
                  : null
              }
              onRetry={() => void corridors.refetch()}
            />
          ) : undefined
        }
        emptyState={
          filtered ? (
            <EmptyState
              icon={<RouteIcon aria-hidden />}
              title={t("noMatchesTitle")}
              description={t("noMatchesDescription")}
              action={
                <Button
                  variant="secondary"
                  onClick={() =>
                    setFilters({
                      [ORIGIN_PARAM]: null,
                      [DESTINATION_PARAM]: null,
                    })
                  }
                >
                  {t("clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<RouteIcon aria-hidden />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={addButton}
            />
          )
        }
      />

      {form && (
        <CorridorFormDialog
          key={form.key}
          open={formOpen}
          onOpenChange={setFormOpen}
          corridor={form.corridor}
        />
      )}
      <DeleteCorridorDialog
        corridor={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

/**
 * One area filter, kept in the URL as the area's id. The name comes from the area just picked,
 * or (after a reload or a shared link) from `areas_get`.
 */
function AreaFilter({ param, label }: { param: string; label: string }) {
  const t = useTranslations("Corridors");
  const { get, setFilter } = useListParams();
  const areaId = get(param) || null;
  const [picked, setPicked] = useState<AreaRef | null>(null);
  const known = picked !== null && picked.id === areaId ? picked : null;
  const area = useArea(known === null ? areaId : null);

  // While the name loads the picker shows "Loading…" as its placeholder; once it can't be
  // named, a label that can still be cleared.
  let value: AreaRef | null = known;
  if (areaId !== null && known === null && area.data) {
    value = { id: areaId, name: area.data.name };
  } else if (areaId !== null && known === null && area.isError) {
    const gone =
      area.error instanceof ApiError &&
      (area.error.status === 404 || area.error.status === 422);
    value = { id: areaId, name: t(gone ? "unknownArea" : "areaUnavailable") };
  }
  const loading = areaId !== null && value === null;

  // Unique ids: Next can keep earlier pages in the document (see SearchField).
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <AreaPicker
        id={id}
        value={value}
        placeholder={t(loading ? "loadingArea" : "anyArea")}
        onChange={(next) => {
          setPicked(next);
          setFilter(param, next?.id ?? null);
        }}
      />
    </div>
  );
}

function DeleteCorridorDialog({
  corridor,
  onClose,
}: {
  corridor: CorridorRead | null;
  onClose: () => void;
}) {
  const t = useTranslations("Corridors");
  const { message } = useApiErrorMessages();
  const remove = useDeleteCorridor();
  // The last corridor shown, so the text doesn't change while the dialog closes.
  const [shown, setShown] = useState(corridor);
  if (corridor && corridor !== shown) setShown(corridor);

  const error = remove.error;
  const waiting = useRetryWait(error);
  const shownNames = shown ? names(shown) : { origin: "", destination: "" };
  return (
    <ConfirmDialog
      open={corridor !== null}
      onOpenChange={(open) => {
        if (open) return;
        // The next time it opens, it starts without this attempt's error.
        remove.reset();
        onClose();
      }}
      title={t("deleteTitle", shownNames)}
      description={t("deleteDescription")}
      confirmLabel={t("delete")}
      tone="destructive"
      pending={remove.isPending}
      confirmDisabled={waiting}
      onConfirm={() => {
        if (!corridor) return;
        remove.mutate(corridor.id, {
          onSuccess: () => {
            showSuccessToast(t("deleted", names(corridor)));
            onClose();
          },
        });
      }}
    >
      {error && (
        <ProblemAlert
          message={
            error instanceof ApiError && error.code === "CORRIDOR_IN_USE"
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
