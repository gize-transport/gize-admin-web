"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import type { Ref } from "react";
import { toolbarButtonClass } from "./toolbar-button";
import { useListParams } from "./use-list-params";

type FilterMenuProps = {
  /** URL search param the filter is stored in, e.g. "type". */
  param: string;
  /** The filter's short name, e.g. "Type": the button shows it, and "Type: Public" once on. */
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** The button, e.g. to move focus to it. */
  ref?: Ref<HTMLButtonElement>;
  /** Text about the filter, e.g. why its choices are missing. */
  "aria-describedby"?: string;
};

/**
 * Single-choice filter (plus "All") synced to the URL, as a menu behind one button (GZW-076;
 * was a row of chips). Arrow keys move through the choices, Enter picks one, Escape closes.
 * Reads the URL (useSearchParams), so it must sit inside a <Suspense>.
 */
export function FilterMenu({
  param,
  label,
  options,
  ref,
  "aria-describedby": describedBy,
}: FilterMenuProps) {
  const t = useTranslations("DataTable");
  const { get, setFilter } = useListParams();
  // An empty value (?type=) means no filter; so does one this filter doesn't know.
  const current = options.find((option) => option.value === get(param));

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        ref={ref}
        aria-describedby={describedBy}
        data-active={current ? "" : undefined}
        className={toolbarButtonClass}
      >
        <span className="truncate">
          {current ? `${label}: ${current.label}` : label}
        </span>
        <ChevronDownIcon aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          // Named by the filter, not by the button's "Type: Public".
          aria-label={label}
          aria-labelledby={undefined}
          align="start"
          sideOffset={4}
          // A long list (the audit log's staff) scrolls within the space below or above.
          className="z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-44 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          <DropdownMenu.RadioGroup
            value={current?.value ?? ""}
            onValueChange={(value) => {
              if (value !== (current?.value ?? "")) {
                setFilter(param, value || null);
              }
            }}
          >
            {[{ value: "", label: t("all") }, ...options].map((option) => (
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
  );
}
