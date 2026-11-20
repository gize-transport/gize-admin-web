"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useListParams } from "./use-list-params";

/**
 * "Clear filters" at the end of a list toolbar: shown while any of `params` is set, and clears
 * them all (back to the first page), leaving focus on the row's first control. Reads the URL, so
 * it must sit inside a <Suspense>.
 */
export function ClearFilters({ params }: { params: readonly string[] }) {
  const t = useTranslations("DataTable");
  const { get, setFilters } = useListParams();
  if (!params.some((param) => get(param))) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        // This button goes with the filters: focus the row's first control, not the page.
        event.currentTarget
          .closest("[data-toolbar-row]")
          ?.querySelector<HTMLElement>("input, button")
          ?.focus();
        setFilters(Object.fromEntries(params.map((param) => [param, null])));
      }}
      className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-table font-semibold text-royal hover:bg-ice"
    >
      <XIcon aria-hidden className="size-4" />
      {t("clearFilters")}
    </button>
  );
}
