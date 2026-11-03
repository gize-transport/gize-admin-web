"use client";

import { Building2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDataTableColumnHelper,
  DataTable,
  FilterChips,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { SearchField } from "@/components/search-field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { useMediaQuery } from "@/lib/use-media-query";
import { CompanyDetail } from "./company-detail";
import { CompanyFormDialog } from "./company-form-dialog";
import { useCompanies } from "./queries";

type CompanyRead = components["schemas"]["CompanyRead"];

const col = createDataTableColumnHelper<CompanyRead>();

/** From this width a company's details open beside the list (design-system.md, "DataTable"). */
const PANEL_QUERY = "(min-width: 1280px)";
/** The company whose details are open in the side panel. */
const SELECTED_PARAM = "company";

/** "true" / "false" in the URL; anything else is no filter. */
function activeFilter(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * Companies (GZW-029): list with name search and status filter, add for staff. A company's details
 * are its own page (`/companies/[id]`); on wide screens a row opens them in a side panel instead.
 */
export function CompaniesScreen() {
  const t = useTranslations("Companies");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const router = useRouter();
  const { cursor, get, setFilters, setParams } = useListParams();
  const q = get("q");
  const isActive = activeFilter(get("is_active"));
  const selectedId = get(SELECTED_PARAM) || null;
  const wide = useMediaQuery(PANEL_QUERY);
  const companies = useCompanies({ q, isActive, cursor });
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // A panel link opened below the panel's width shows the page instead. Only when it is opened:
  // narrowing the window later just hides the panel (an open form in it isn't thrown away), and
  // widening shows it again.
  const checkedWidth = useRef(false);
  useEffect(() => {
    if (wide === null || checkedWidth.current) return;
    checkedWidth.current = true;
    if (selectedId && !wide) {
      router.replace(`/companies/${encodeURIComponent(selectedId)}`);
    }
  }, [selectedId, wide, router]);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  // Closing the panel sends focus back to the row that opened it (WCAG 2.4.3), once the
  // navigation that closes it has rendered.
  const focusRowAfterClose = useRef<string | null>(null);
  useEffect(() => {
    const id = focusRowAfterClose.current;
    if (id === null || selectedId !== null) return;
    focusRowAfterClose.current = null;
    document
      .querySelector<HTMLElement>(
        `[data-row-action][href="/companies/${CSS.escape(id)}"]`,
      )
      ?.focus();
  }, [selectedId]);

  function closePanel() {
    focusRowAfterClose.current = selectedId;
    setParams({ [SELECTED_PARAM]: null });
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: t("colName"),
          cell: (info) => {
            const id = info.row.original.id;
            return (
              <RowAction
                href={`/companies/${id}`}
                current={wide === true && id === selectedId}
                onNavigate={(event) => {
                  // New tabs and narrow screens follow the link to the page.
                  const plainClick =
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey;
                  if (wide !== true || !plainClick) return;
                  event.preventDefault();
                  setParams({ [SELECTED_PARAM]: id });
                }}
              >
                {info.getValue()}
              </RowAction>
            );
          },
        }),
        col.accessor("contact_name", { header: t("colContact") }),
        col.accessor("is_active", {
          header: t("colStatus"),
          cell: (info) =>
            info.getValue() ? (
              <StatusPill tone="success">{t("active")}</StatusPill>
            ) : (
              <StatusPill tone="neutral">{t("inactive")}</StatusPill>
            ),
        }),
        col.accessor("created_at", {
          header: t("colAdded"),
          cell: (info) => date(info.getValue()),
        }),
      ]),
    [t, date, wide, selectedId, setParams],
  );

  const addButton = (
    <Button onClick={openForm}>
      <PlusIcon aria-hidden />
      {t("add")}
    </Button>
  );

  if (isForbidden(companies.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered = Boolean(q) || isActive !== null;
  const panelOpen = wide === true && selectedId !== null;
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={addButton}
      />
      <div className="flex flex-wrap items-end gap-4">
        <SearchField
          param="q"
          label={t("searchLabel")}
          placeholder={t("searchHint")}
        />
        <FilterChips
          param="is_active"
          label={t("statusFilter")}
          options={[
            { value: "true", label: t("filterActive") },
            { value: "false", label: t("filterInactive") },
          ]}
        />
      </div>
      <div
        className={
          panelOpen
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "grid"
        }
      >
        <DataTable
          label={t("tableLabel")}
          columns={columns}
          data={companies.data?.items}
          getRowId={(company) => company.id}
          isLoading={companies.isPending}
          nextCursor={companies.data?.next_cursor ?? null}
          selectedRowId={panelOpen ? selectedId : null}
          error={
            companies.isError ? (
              <ProblemAlert
                message={message(companies.error)}
                requestId={
                  companies.error instanceof ApiError
                    ? companies.error.requestId
                    : null
                }
                retryAfterSeconds={
                  companies.error instanceof ApiError
                    ? companies.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void companies.refetch()}
              />
            ) : undefined
          }
          emptyState={
            filtered ? (
              <EmptyState
                icon={<Building2Icon aria-hidden />}
                title={t("noMatchesTitle")}
                description={t("noMatchesDescription")}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ q: null, is_active: null })}
                  >
                    {t("clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Building2Icon aria-hidden />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={addButton}
              />
            )
          }
        />
        {panelOpen && selectedId && (
          <div className="xl:sticky xl:top-6">
            <CompanyDetail
              key={selectedId}
              companyId={selectedId}
              variant="panel"
              onClose={closePanel}
              // Replaced, so Back doesn't reopen the deleted company.
              onDeleted={() =>
                setParams({ [SELECTED_PARAM]: null }, { replace: true })
              }
            />
          </div>
        )}
      </div>

      {formKey !== null && (
        <CompanyFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}
    </>
  );
}
