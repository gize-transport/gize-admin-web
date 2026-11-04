"use client";

import { UserPlusIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  createDataTableColumnHelper,
  DataTable,
  FilterChips,
  RowAction,
  useListParams,
} from "@/components/data-table";
import { useDetailPanel } from "@/components/detail/use-detail-panel";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useTimestampFormat } from "@/lib/time";
import { InviteStaffDialog } from "./invite-staff-dialog";
import { useStaffMembers, type StaffRole } from "./queries";
import { StaffDetail } from "./staff-detail";
import { StaffStatusPill } from "./staff-status";

type StaffRead = components["schemas"]["StaffRead"];

const col = createDataTableColumnHelper<StaffRead>();
const ROLES: StaffRole[] = ["admin", "staff"];
const FILTERS = ["role", "is_active"];

/**
 * Staff accounts (GZW-060, admins): who can sign in, with role and status filters; admins
 * invite people. A member's details are their own page (`/staff/[id]`); on wide screens a row
 * opens them in a side panel instead. Names and emails never go into URLs or toasts.
 */
export function StaffScreen() {
  const t = useTranslations("Staff");
  const { message } = useApiErrorMessages();
  const { date } = useTimestampFormat();
  const { cursor, get, setFilters } = useListParams();
  const detail = useDetailPanel({ param: "member", basePath: "/staff" });
  const me = useCurrentStaff().data?.id ?? null;
  const roleParam = get("role");
  const active = get("is_active");
  const filters = {
    role: ROLES.includes(roleParam as StaffRole)
      ? (roleParam as StaffRole)
      : null,
    isActive: active === "true" ? true : active === "false" ? false : null,
    cursor,
  };
  const members = useStaffMembers(filters);
  const [formKey, setFormKey] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm() {
    setFormKey((key) => (key ?? 0) + 1);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("full_name", {
          header: t("colName"),
          cell: (info) => (
            <span className="grid gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <RowAction {...detail.rowLink(info.row.original.id)}>
                  {info.getValue()}
                </RowAction>
                {info.row.original.id === me && (
                  <span className="text-meta text-muted">{t("you")}</span>
                )}
              </span>
              <span className="text-meta text-muted">
                {info.row.original.email}
              </span>
            </span>
          ),
        }),
        col.accessor("role", {
          header: t("colRole"),
          cell: (info) =>
            t(info.getValue() === "admin" ? "roleAdmin" : "roleStaff"),
        }),
        col.display({
          id: "status",
          header: t("colStatus"),
          cell: (info) => <StaffStatusPill member={info.row.original} />,
        }),
        col.accessor("created_at", {
          header: t("colAdded"),
          cell: (info) => (
            <span className="whitespace-nowrap">{date(info.getValue())}</span>
          ),
        }),
      ]),
    [t, detail, date, me],
  );

  const inviteButton = (
    <Button onClick={openForm}>
      <UserPlusIcon aria-hidden />
      {t("invite")}
    </Button>
  );

  if (isForbidden(members.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered = filters.role !== null || filters.isActive !== null;
  // A filter the API can't read (a hand-edited address): nothing matches, offer to clear it.
  const badFilter =
    filtered &&
    members.error instanceof ApiError &&
    members.error.code === "VALIDATION_FAILED";
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={inviteButton}
      />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FilterChips
          param="role"
          label={t("roleFilter")}
          options={[
            { value: "admin", label: t("roleAdmin") },
            { value: "staff", label: t("roleStaff") },
          ]}
        />
        <FilterChips
          param="is_active"
          label={t("statusFilter")}
          options={[
            { value: "true", label: t("filterActive") },
            { value: "false", label: t("filterDeactivated") },
          ]}
        />
      </div>
      <div
        className={
          detail.panelId
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "grid"
        }
      >
        <DataTable
          label={t("tableLabel")}
          columns={columns}
          data={badFilter ? [] : members.data?.items}
          getRowId={(member) => member.id}
          isLoading={members.isPending}
          nextCursor={members.data?.next_cursor ?? null}
          selectedRowId={detail.panelId}
          error={
            members.isError && !badFilter ? (
              <ProblemAlert
                message={message(members.error)}
                requestId={
                  members.error instanceof ApiError
                    ? members.error.requestId
                    : null
                }
                retryAfterSeconds={
                  members.error instanceof ApiError
                    ? members.error.retryAfterSeconds
                    : null
                }
                onRetry={() => void members.refetch()}
              />
            ) : undefined
          }
          emptyState={
            filtered ? (
              <EmptyState
                icon={<UsersIcon aria-hidden />}
                title={t("noMatchesTitle")}
                description={t("noMatchesDescription")}
                action={
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFilters(
                        Object.fromEntries(FILTERS.map((key) => [key, null])),
                      )
                    }
                  >
                    {t("clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<UsersIcon aria-hidden />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={inviteButton}
              />
            )
          }
        />
        {detail.panelId && (
          <div className="xl:sticky xl:top-6">
            <StaffDetail
              key={detail.panelId}
              staffId={detail.panelId}
              variant="panel"
              onClose={detail.closePanel}
            />
          </div>
        )}
      </div>

      {formKey !== null && (
        <InviteStaffDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          onOpenMember={(id) => detail.openPanel(id)}
        />
      )}
    </>
  );
}
