"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useListParams } from "./use-list-params";

type FilterChipsProps = {
  /** URL search param the filter is stored in, e.g. "type". */
  param: string;
  /** Names the group for screen readers, e.g. "Route type". */
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

/**
 * Single-choice filter (plus "All") synced to the URL, as in the list mockups. Reads the URL
 * (useSearchParams), so under `cacheComponents` it must sit inside a <Suspense>.
 */
export function FilterChips({ param, label, options }: FilterChipsProps) {
  const t = useTranslations("DataTable");
  const { get, setFilter } = useListParams();
  // An empty value (?type=) means no filter.
  const current = get(param) || null;

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {[{ value: null, label: t("all") }, ...options].map((option) => {
        const pressed = current === option.value;
        return (
          <button
            key={option.value ?? ""}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) setFilter(param, option.value);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-table font-medium text-ink transition-colors duration-150 hover:border-royal hover:bg-ice aria-pressed:border-royal aria-pressed:bg-ice aria-pressed:text-navy [&_svg]:size-4"
          >
            {/* The check mark shows the selection without relying on colour. */}
            {pressed && <CheckIcon aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
