"use client";

import { Building2Icon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { IconAvatar } from "@/components/avatar";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  ClearFilters,
  FilterMenu,
  ListToolbar,
  NameSortMenu,
  RowAction,
  useListParams,
  useListSort,
} from "@/components/data-table";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
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
import { CompanyDetail } from "./company-detail";
import { CompanyFormDialog } from "./company-form-dialog";
import { useCompanies, COMPANY_SORTS } from "./queries";

type CompanyRead = components["schemas"]["CompanyRead"];

const col = createDataTableColumnHelper<CompanyRead>();

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
  const { cursor, get, setFilters } = useListParams();
  const detail = useDetailPanel({ param: "company", basePath: "/companies" });
  const q = get("q");
  const isActive = activeFilter(get("is_active"));
  const sort = useListSort(COMPANY_SORTS);
  const companies = useCompanies({ q, isActive, sort, cursor });
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: t("colName"),
          cell: (info) => {
            const id = info.row.original.id;
            return (
              <CellWithPicture picture={<IconAvatar icon={Building2Icon} />}>
                <RowAction {...detail.rowLink(id)}>{info.getValue()}</RowAction>
              </CellWithPicture>
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
    [t, date, detail],
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
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div
        className={
          detail.panelId
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "grid"
        }
      >
        <DataTable
          toolbar={
            <ListToolbar action={addButton}>
              <SearchField
                param="q"
                label={t("searchLabel")}
                placeholder={t("searchHint")}
              />
              <FilterMenu
                param="is_active"
                label={t("statusFilter")}
                options={[
                  { value: "true", label: t("filterActive") },
                  { value: "false", label: t("filterInactive") },
                ]}
              />
              <ClearFilters params={["q", "is_active"]} />
              <NameSortMenu />
            </ListToolbar>
          }
          label={t("tableLabel")}
          columns={columns}
          data={companies.data?.items}
          getRowId={(company) => company.id}
          isLoading={companies.isPending}
          nextCursor={companies.data?.next_cursor ?? null}
          selectedRowId={detail.panelId}
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
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <CompanyDetail
              key={detail.panelId}
              companyId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
              onDeleted={detail.closeAfterDelete}
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
