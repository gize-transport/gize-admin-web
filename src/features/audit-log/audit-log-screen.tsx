"use client";

import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import {
  createDataTableColumnHelper,
  DataTable,
  useListParams,
} from "@/components/data-table";
import { isNotFound } from "@/components/detail/detail-frame";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStaffMember } from "@/features/staff/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { useAuditActors, useAuditLog } from "./queries";

type AuditEntryRead = components["schemas"]["AuditEntryRead"];

const col = createDataTableColumnHelper<AuditEntryRead>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_TYPE = /^[a-z][a-z_]*$/;
/** How the API writes a personal value it keeps only the change of. */
const REDACTED = "[redacted]";

const ENTITIES = [
  "area",
  "corridor",
  "company",
  "route",
  "route_request",
  "rider",
  "route_assignment",
  "staff",
] as const;
type Entity = (typeof ENTITIES)[number] | "other";

/** Records with a page of their own; areas and corridors are edited in their lists. */
const RECORD_PAGES: Partial<Record<Entity, string>> = {
  company: "/companies",
  route: "/routes",
  route_request: "/route-requests",
  rider: "/riders",
  staff: "/staff",
};

function entityOf(type: string): Entity {
  return (ENTITIES as readonly string[]).includes(type)
    ? (type as Entity)
    : "other";
}

/**
 * The audit log (GZW-061, admins): every recorded change, newest first, filtered by the person
 * who made it or by one record (type and ID together, from an entry's "This record's
 * history"). An entry's changes show as a before/after table; personal values the API hides
 * ("[redacted]") read as hidden, never as data.
 */
export function AuditLogScreen() {
  const t = useTranslations("AuditLog");
  const { message } = useApiErrorMessages();
  const { dateTime } = useTimestampFormat();
  const { cursor, get, setFilters } = useListParams();
  const type = get("entity_type");
  const id = get("entity_id");
  const actor = get("actor_staff_id");
  const filters = {
    // Only a well-formed pair: anything else in the address is no filter.
    entity:
      type && id && ENTITY_TYPE.test(type) && UUID.test(id)
        ? { type, id }
        : null,
    actorId: actor && UUID.test(actor) ? actor : null,
    cursor,
  };
  const entries = useAuditLog(filters);
  const actors = useAuditActors();
  // Names already loaded for the "Done by" list: rows don't fetch them again.
  const names = useMemo(
    () =>
      new Map(
        (actors.data?.items ?? []).map((member) => [
          member.id,
          member.full_name,
        ]),
      ),
    [actors.data],
  );
  // A filter changed from a button: the button goes (its row, the banner), so focus moves to
  // what replaced it once rendered – the record banner, or the "Done by" select.
  const focusNext = useRef<"banner" | "actor" | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLSelectElement>(null);
  const entityKey = filters.entity
    ? `${filters.entity.type}:${filters.entity.id}`
    : "";
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === "banner") bannerRef.current?.focus();
    if (next === "actor") actorRef.current?.focus();
  }, [entityKey]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("created_at", {
          header: t("colWhen"),
          cell: (info) => (
            <span className="whitespace-nowrap">
              {dateTime(info.getValue())}
            </span>
          ),
        }),
        col.display({
          id: "change",
          header: t("colChange"),
          cell: (info) => {
            const entry = info.row.original;
            return (
              <span className="grid gap-0.5">
                <span className="font-semibold text-ink">
                  {actionLabel(entry.action, t)}
                </span>
                <RecordLink entry={entry} when={dateTime(entry.created_at)} />
              </span>
            );
          },
        }),
        col.accessor("actor_staff_id", {
          header: t("colBy"),
          cell: (info) => <ActorName id={info.getValue()} names={names} />,
        }),
        col.display({
          id: "details",
          header: t("colDetails"),
          cell: (info) => (
            <EntryDetails
              entry={info.row.original}
              onHistory={() => {
                focusNext.current = "banner";
                // The whole history: whoever made the changes.
                setFilters({
                  entity_type: info.row.original.entity_type,
                  entity_id: info.row.original.entity_id,
                  actor_staff_id: null,
                });
              }}
            />
          ),
        }),
      ]),
    [t, dateTime, setFilters, names],
  );

  if (isForbidden(entries.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  const filtered = filters.entity !== null || filters.actorId !== null;
  const clearAll = () => {
    focusNext.current = "actor";
    setFilters({ entity_type: null, entity_id: null, actor_staff_id: null });
  };
  const badFilter =
    filtered &&
    entries.error instanceof ApiError &&
    entries.error.code === "VALIDATION_FAILED";
  const entity = filters.entity ? entityOf(filters.entity.type) : null;
  const recordPage = entity ? RECORD_PAGES[entity] : undefined;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4">
        <ActorFilter
          ref={actorRef}
          actorId={filters.actorId}
          actors={actors}
          names={names}
        />
        {filters.entity && entity && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-ice px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-royal"
          >
            <p className="text-body text-ink">
              {t("recordFilter", { type: t(`entity.${entity}`) })}
            </p>
            {recordPage && (
              <Link
                href={`${recordPage}/${filters.entity.id}`}
                className="text-table font-semibold text-royal underline-offset-4 hover:underline"
              >
                {t("openRecord", { type: t(`entity.${entity}`) })}
              </Link>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                focusNext.current = "actor";
                setFilters({ entity_type: null, entity_id: null });
              }}
            >
              {t("showAll")}
            </Button>
          </div>
        )}
      </div>
      <DataTable
        label={t("tableLabel")}
        columns={columns}
        data={badFilter ? [] : entries.data?.items}
        getRowId={(entry) => entry.id}
        isLoading={entries.isPending}
        nextCursor={entries.data?.next_cursor ?? null}
        error={
          entries.isError && !badFilter ? (
            <ProblemAlert
              message={message(entries.error)}
              requestId={
                entries.error instanceof ApiError
                  ? entries.error.requestId
                  : null
              }
              retryAfterSeconds={
                entries.error instanceof ApiError
                  ? entries.error.retryAfterSeconds
                  : null
              }
              onRetry={() => void entries.refetch()}
            />
          ) : undefined
        }
        emptyState={
          filtered ? (
            <EmptyState
              icon={<HistoryIcon aria-hidden />}
              title={t("noMatchesTitle")}
              description={t("noMatchesDescription")}
              action={
                <Button variant="secondary" onClick={clearAll}>
                  {t("clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<HistoryIcon aria-hidden />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          )
        }
      />
    </>
  );
}

type T = ReturnType<typeof useTranslations<"AuditLog">>;

/** "Route status changed"; an action this portal doesn't know yet reads as the API wrote it. */
function actionLabel(action: string, t: T) {
  const key = `actions.${action}`;
  return t.has(key as Parameters<T>[0]) ? t(key as Parameters<T>[0]) : action;
}

/** The record, linked when it has a page ("Route", to screen readers "Route changed …"). */
function RecordLink({ entry, when }: { entry: AuditEntryRead; when: string }) {
  const t = useTranslations("AuditLog");
  const entity = entityOf(entry.entity_type);
  const page = RECORD_PAGES[entity];
  const label = t(`entityTitle.${entity}`);
  if (!page) return <span className="text-meta text-muted">{label}</span>;
  return (
    <Link
      href={`${page}/${entry.entity_id}`}
      className="w-fit text-meta font-semibold text-royal underline-offset-4 hover:underline"
    >
      {label} <span className="sr-only">{t("recordLinkSpoken", { when })}</span>
    </Link>
  );
}

/** Who made the change: a staff member's name, or an operator command. */
function ActorName({
  id,
  names,
}: {
  id: string | null;
  names: Map<string, string>;
}) {
  const t = useTranslations("AuditLog");
  const known = id === null ? undefined : names.get(id);
  // Only someone not in the "Done by" list is fetched.
  const member = useStaffMember(id !== null && known === undefined ? id : null);
  if (id === null) return <span className="text-muted">{t("operator")}</span>;
  if (known !== undefined) return <>{known}</>;
  if (member.isPending) {
    return <span className="text-muted">{t("loadingName")}</span>;
  }
  if (member.isError) {
    return (
      <span className="text-muted">
        {isNotFound(member.error) ? t("unknownActor") : t("nameUnavailable")}
      </span>
    );
  }
  return <>{member.data.full_name}</>;
}

/** The changes as a before/after table, behind a disclosure; and this record's history. */
function EntryDetails({
  entry,
  onHistory,
}: {
  entry: AuditEntryRead;
  onHistory: () => void;
}) {
  const t = useTranslations("AuditLog");
  const tableId = useId();
  const fields = [
    ...new Set([
      ...Object.keys(entry.before ?? {}),
      ...Object.keys(entry.after ?? {}),
    ]),
  ];
  return (
    <details className="group min-w-56">
      <summary className="w-fit cursor-pointer text-table font-semibold text-royal underline-offset-4 hover:underline">
        {t("showChanges")}
      </summary>
      <div className="mt-3 grid gap-3">
        <table
          aria-labelledby={tableId}
          className="w-full border-collapse text-table"
        >
          <caption id={tableId} className="sr-only">
            {t("changesLabel")}
          </caption>
          <thead>
            <tr className="text-left text-meta text-muted">
              <th scope="col" className="py-1 pr-3 font-semibold">
                {t("colField")}
              </th>
              <th scope="col" className="py-1 pr-3 font-semibold">
                {t("colBefore")}
              </th>
              <th scope="col" className="py-1 font-semibold">
                {t("colAfter")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field} className="border-t border-line align-top">
                <th scope="row" className="py-1.5 pr-3 font-medium text-ink">
                  {fieldLabel(field, t)}
                </th>
                <td className="py-1.5 pr-3">
                  <Value
                    field={field}
                    value={entry.before?.[field]}
                    missing={entry.before === null}
                  />
                </td>
                <td className="py-1.5">
                  <Value
                    field={field}
                    value={entry.after?.[field]}
                    missing={entry.after === null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entry.request_id && (
          <p className="text-meta text-muted">
            {t("requestId", { id: entry.request_id })}
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={onHistory}
        >
          {t("recordHistory")}
        </Button>
      </div>
    </details>
  );
}

function fieldLabel(field: string, t: T) {
  const key = `fields.${field}`;
  if (t.has(key as Parameters<T>[0])) return t(key as Parameters<T>[0]);
  // A field this portal doesn't know yet: its name in words.
  const words = field.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One value as people read it; hidden personal data says so, and is never shown as data. */
function Value({
  field,
  value,
  missing,
}: {
  field: string;
  value: unknown;
  /** No before (created) or no after (removed) at all. */
  missing: boolean;
}) {
  const t = useTranslations("AuditLog");
  const { dateTime } = useTimestampFormat();
  const { date } = useTimestampFormat();
  const valueKey = `values.${field}.${String(value)}`;
  let shown: ReactNode;
  if (missing || value === undefined) {
    shown = (
      <>
        <span aria-hidden="true" className="text-muted">
          –
        </span>
        <span className="sr-only">{t("noValue")}</span>
      </>
    );
  } else if (value === REDACTED) {
    shown = <span className="text-muted italic">{t("redacted")}</span>;
  } else if (value === null) shown = <Muted>{t("notSet")}</Muted>;
  else if (typeof value === "boolean") shown = t(value ? "yes" : "no");
  else if (typeof value === "number" && field.startsWith("price_")) {
    shown = t("priceValue", { amount: value });
  } else if (typeof value === "string" && t.has(valueKey as Parameters<T>[0])) {
    // A status, role, kind…: in words.
    shown = t(valueKey as Parameters<T>[0]);
  } else if (Array.isArray(value)) {
    shown =
      value.length === 0 && field === "served_area_ids" ? (
        t("areasCount", { count: 0 })
      ) : (
        <span className="grid gap-0.5">
          {value.map((item, index) => (
            <span key={index}>
              <ShownValue value={item} />
            </span>
          ))}
        </span>
      );
  } else if (typeof value === "string" && field.endsWith("_at")) {
    shown = dateTime(value);
  } else if (typeof value === "string" && field.endsWith("_date")) {
    shown = date(`${value}T00:00:00Z`);
  } else shown = <ShownValue value={value} />;
  return <span className="break-words">{shown}</span>;
}

/** A plain value; an ID (an area, corridor, route…) short on screen, whole to screen readers. */
function ShownValue({ value }: { value: unknown }) {
  if (typeof value === "string" && UUID.test(value)) {
    return (
      <span className="font-mono" title={value}>
        <span aria-hidden="true">{`${value.slice(0, 8)}…`}</span>
        <span className="sr-only">{value}</span>
      </span>
    );
  }
  if (value !== null && typeof value === "object") {
    return <>{JSON.stringify(value)}</>;
  }
  return <>{String(value)}</>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted">{children}</span>;
}

/** "Done by": the staff list as a select, kept in the URL as the person's ID. */
function ActorFilter({
  ref,
  actorId,
  actors,
  names,
}: {
  ref: Ref<HTMLSelectElement>;
  actorId: string | null;
  actors: ReturnType<typeof useAuditActors>;
  names: Map<string, string>;
}) {
  const t = useTranslations("AuditLog");
  const uid = useId();
  const { setFilter } = useListParams();
  const listed = actorId !== null && names.has(actorId);
  // The one in the address but not in the list (past the first 100, or the list failed).
  const other = useStaffMember(
    actorId !== null && !listed && !actors.isPending ? actorId : null,
  );
  let otherName = t("loadingName");
  if (other.isSuccess) otherName = other.data.full_name;
  else if (other.isError) {
    otherName = isNotFound(other.error)
      ? t("unknownActor")
      : t("nameUnavailable");
  }
  return (
    <div className="grid max-w-sm gap-1.5">
      <Label htmlFor={`${uid}-actor`}>{t("actorFilter")}</Label>
      <select
        ref={ref}
        id={`${uid}-actor`}
        value={actorId ?? ""}
        aria-describedby={actors.isError ? `${uid}-actor-error` : undefined}
        onChange={(event) =>
          setFilter("actor_staff_id", event.target.value || null)
        }
        className="h-10 rounded-lg border border-line bg-surface px-3 text-body text-ink"
      >
        <option value="">{t("anyone")}</option>
        {actorId !== null && !listed && (
          <option value={actorId}>{otherName}</option>
        )}
        {[...names].map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      {actors.isError && (
        <p id={`${uid}-actor-error`} className="text-table text-muted">
          {t("actorsUnavailable")}
        </p>
      )}
    </div>
  );
}
