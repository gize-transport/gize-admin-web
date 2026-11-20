"use client";

import { ArrowUpDownIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { toolbarButtonClass } from "./toolbar-button";
import { useListParams } from "./use-list-params";

/** URL search param that holds a list's order (the API's `sort`, GZ-081). */
export const SORT_PARAM = "sort";

/**
 * The order the URL asks for, to send as the API's `sort`; null for the list's default (the
 * first of `values`) and for a value the list doesn't take. Reads the URL, so it must sit inside
 * a <Suspense>.
 */
export function useListSort<T extends string>(values: readonly T[]): T | null {
  const { get } = useListParams();
  const value = get(SORT_PARAM);
  return values.slice(1).find((candidate) => candidate === value) ?? null;
}

type SortMenuProps = {
  /** The orders the list takes; the first is its default, which leaves `sort` out of the URL. */
  options: ReadonlyArray<{ value: string; label: string }>;
};

/**
 * The list's order (GZW-081), after its filters: a menu behind one button, like FilterMenu. It
 * reads "Sort" on the default order and names any other ("Sort: Name A to Z"), light blue like a
 * filter that's on. A new order starts again from the first page: the API pages a list only in
 * the order its cursor was made for. Reads the URL, so it must sit inside a <Suspense>.
 */
export function SortMenu({ options }: SortMenuProps) {
  const t = useTranslations("DataTable");
  const { get, setFilter } = useListParams();
  const [initial] = options;
  const current =
    options.find((option) => option.value === get(SORT_PARAM)) ?? initial;
  const sorted = current !== undefined && current !== initial;

  return (
    <>
      {/* Sets the order apart from the filters; not needed once the row wraps on phones. */}
      <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-line sm:block" />
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          data-active={sorted ? "" : undefined}
          className={toolbarButtonClass}
        >
          <ArrowUpDownIcon aria-hidden />
          <span className="truncate">
            {sorted ? t("sortBy", { order: current.label }) : t("sort")}
          </span>
          <ChevronDownIcon aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            // Named "Sort", not by the button's "Sort: Name A to Z".
            aria-label={t("sort")}
            aria-labelledby={undefined}
            align="start"
            sideOffset={4}
            className="z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
          >
            <DropdownMenu.RadioGroup
              value={current?.value ?? ""}
              onValueChange={(value) => {
                if (value === current?.value) return;
                setFilter(SORT_PARAM, value === initial?.value ? null : value);
              }}
            >
              {options.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2.5 py-2 text-table text-ink outline-none select-none data-highlighted:bg-ice data-[state=checked]:font-semibold data-[state=checked]:text-navy"
                >
                  {option.label}
                  <DropdownMenu.ItemIndicator>
                    <CheckIcon aria-hidden className="size-4" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}

/** SortMenu for the orders most lists take: newest first (the default) or by name A to Z. */
export function NameSortMenu() {
  const t = useTranslations("DataTable");
  return (
    <SortMenu
      options={[
        { value: "newest", label: t("sortNewest") },
        { value: "name", label: t("sortName") },
      ]}
    />
  );
}
