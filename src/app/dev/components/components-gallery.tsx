"use client";

import { RouteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DataTable,
  FilterChips,
  RowAction,
  createDataTableColumnHelper,
  useListParams,
} from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { ProblemAlert } from "@/components/problem-alert";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  amharicSample,
  pageSize,
  plateSample,
  sampleRequestId,
  sampleRoutes,
  type SampleRoute,
} from "./sample-data";

const colourTokens = [
  ["navy", "bg-navy"],
  ["royal", "bg-royal"],
  ["blue", "bg-blue"],
  ["sky", "bg-sky"],
  ["ice", "bg-ice"],
  ["sun", "bg-sun"],
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["line", "bg-line"],
  ["success", "bg-success"],
  ["success-soft", "bg-success-soft"],
  ["danger", "bg-danger"],
  ["danger-soft", "bg-danger-soft"],
  ["neutral-soft", "bg-neutral-soft"],
] as const;

const statusTone: Record<SampleRoute["status"], StatusTone> = {
  draft: "neutral",
  forming: "waiting",
  active: "success",
  paused: "neutral",
};

const col = createDataTableColumnHelper<SampleRoute>();
const noRoutes: SampleRoute[] = [];

export function ComponentsGallery() {
  const t = useTranslations("DevComponents");

  return (
    <div className="grid gap-12">
      <Section title={t("colours")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {colourTokens.map(([name, swatch]) => (
            <li key={name} className="grid gap-1.5">
              <span
                className={`h-12 rounded-lg border border-line ${swatch}`}
              />
              <code className="font-mono text-meta text-ink">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("typography")}>
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-6">
          <p className="font-display text-title font-semibold text-navy">
            {t("typeTitle")}
          </p>
          <p className="font-display text-section font-semibold text-navy">
            {t("typeSection")}
          </p>
          <p className="text-body">
            {t("typeBody", { amharic: amharicSample })}
          </p>
          <p className="text-table">{t("typeTable")}</p>
          <p className="text-meta text-muted">{t("typeMeta")}</p>
          <p className="font-mono text-table">
            {t("typeMono", { sample: plateSample })}
          </p>
        </div>
      </Section>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("primary")}</Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button variant="destructive">{t("destructive")}</Button>
          <Button variant="link">{t("link")}</Button>
          <Button pending>{t("pending")}</Button>
        </div>
      </Section>

      <Section title={t("statusPills")}>
        <div className="flex flex-wrap gap-3">
          <StatusPill tone="success">{t("statusActive")}</StatusPill>
          <StatusPill tone="waiting">{t("statusForming")}</StatusPill>
          <StatusPill tone="neutral">{t("statusPaused")}</StatusPill>
          <StatusPill tone="danger">{t("statusDeclined")}</StatusPill>
        </div>
      </Section>

      <Section title={t("emptyState")}>
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<RouteIcon aria-hidden />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={<Button variant="secondary">{t("emptyAction")}</Button>}
          />
        </div>
      </Section>

      <Section title={t("noPermission")}>
        <NoPermission />
      </Section>

      <Section title={t("problemAlert")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProblemAlert
            message={t("problemMessage")}
            requestId={sampleRequestId}
            onRetry={() => {}}
          />
          <ProblemAlert
            message={t("problemRateLimited")}
            requestId={sampleRequestId}
            retryAfterSeconds={30}
            onRetry={() => {}}
          />
        </div>
      </Section>

      <Section title={t("confirmDialog")}>
        <ConfirmDialogDemo />
      </Section>

      <Section title={t("dataTable")}>
        {/* The table demo reads filters and the cursor from the URL, so it renders on the client. */}
        <Suspense>
          <DataTableDemo />
        </Suspense>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="font-display text-section font-semibold text-navy">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ConfirmDialogDemo() {
  const t = useTranslations("DevComponents");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function openRoute() {
    setPending(true);
    // Stands in for the API call.
    setTimeout(() => {
      setPending(false);
      setOpen(false);
      showSuccessToast(t("routeOpened"));
    }, 800);
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)}>{t("openRoute")}</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("confirmAction")}
        pending={pending}
        onConfirm={openRoute}
      />
    </div>
  );
}

function DataTableDemo() {
  const t = useTranslations("DevComponents");
  const { cursor, get } = useListParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const typeLabels: Record<SampleRoute["type"], string> = {
      public: t("typePublic"),
      student: t("typeStudent"),
      corporate: t("typeCorporate"),
    };
    const statusLabels: Record<SampleRoute["status"], string> = {
      draft: t("statusDraft"),
      forming: t("statusForming"),
      active: t("statusActive"),
      paused: t("statusPaused"),
    };
    return col.columns([
      col.accessor("code", {
        header: t("colRoute"),
        cell: (info) => (
          <div className="grid min-w-36 gap-0.5">
            <RowAction
              onSelect={() => setSelectedId(info.row.original.id)}
              current={info.row.original.id === selectedId}
            >
              {info.getValue()}
            </RowAction>
            <span className="text-meta text-muted">
              {info.row.original.name}
            </span>
          </div>
        ),
      }),
      col.accessor("type", {
        header: t("colType"),
        cell: (info) => typeLabels[info.getValue()],
      }),
      col.display({
        id: "seats",
        header: t("colSeats"),
        cell: (info) =>
          t("seats", {
            taken: info.row.original.seatsTaken,
            total: info.row.original.seatsTotal,
          }),
      }),
      col.accessor("driver", {
        header: t("colDriver"),
        cell: (info) =>
          info.getValue() ?? (
            <span className="text-muted">{t("notAssigned")}</span>
          ),
      }),
      col.accessor("status", {
        header: t("colStatus"),
        cell: (info) => (
          <StatusPill tone={statusTone[info.getValue()]}>
            {statusLabels[info.getValue()]}
          </StatusPill>
        ),
      }),
    ]);
  }, [t, selectedId]);

  // Stands in for the API: filter by type, then page with an offset cursor.
  const type = get("type");
  const offset = Math.max(0, Number(cursor) || 0);
  const { pageRows, nextCursor } = useMemo(() => {
    const filtered = sampleRoutes.filter(
      (route) => !type || route.type === type,
    );
    return {
      pageRows: filtered.slice(offset, offset + pageSize),
      nextCursor:
        offset + pageSize < filtered.length ? String(offset + pageSize) : null,
    };
  }, [type, offset]);
  const selected = sampleRoutes.find((route) => route.id === selectedId);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <FilterChips
          param="type"
          label={t("routeTypeFilter")}
          options={[
            { value: "public", label: t("typePublic") },
            { value: "student", label: t("typeStudent") },
            { value: "corporate", label: t("typeCorporate") },
          ]}
        />
        <p className="text-table text-muted">
          {selected
            ? t("selectedRoute", { route: selected.code })
            : t("noRouteSelected")}
        </p>
        <DataTable
          label={t("routesLabel")}
          columns={columns}
          data={pageRows}
          getRowId={(route) => route.id}
          nextCursor={nextCursor}
          selectedRowId={selectedId}
          emptyState={<EmptyState title={t("emptyTitle")} />}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold text-navy">{t("loadingTable")}</h3>
        <DataTable
          label={t("loadingTable")}
          columns={columns}
          data={undefined}
          isLoading
          getRowId={(route) => route.id}
          emptyState={null}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold text-navy">{t("emptyTable")}</h3>
        <DataTable
          label={t("emptyTable")}
          columns={columns}
          data={noRoutes}
          getRowId={(route) => route.id}
          emptyState={
            <EmptyState
              icon={<RouteIcon aria-hidden />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={<Button variant="secondary">{t("emptyAction")}</Button>}
            />
          }
        />
      </div>
    </div>
  );
}
