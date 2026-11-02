"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProblemAlert } from "@/components/problem-alert";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { searchAreas, type AreaSearchResult } from "@/features/areas/queries";

type AreaRef = components["schemas"]["AreaRef"];

const SEARCH_DELAY_MS = 250;

type AreaPickerProps = {
  /** For the field's <label htmlFor>. */
  id?: string;
  value: AreaRef | null;
  onChange: (area: AreaRef | null) => void;
  /** Marks the field invalid (form errors). */
  invalid?: boolean;
  "aria-describedby"?: string;
  /**
   * Where the options come from; defaults to `areas_list`. Tests and the gallery pass their own
   * (one source per page: the results are cached by the search text only).
   */
  search?: (q: string) => Promise<AreaSearchResult>;
};

/**
 * Chooses an area from the API's list, never free text (design-system.md, "Pickers"): a button
 * showing the choice opens a search box with matching areas; arrow keys and Enter pick one.
 */
export function AreaPicker({
  id,
  value,
  onChange,
  invalid,
  "aria-describedby": describedBy,
  search = searchAreas,
}: AreaPickerProps) {
  const t = useTranslations("AreaPicker");
  const { message } = useApiErrorMessages();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  // Search after a short pause in typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    // Under "areas", so adding, renaming or deleting an area refreshes the picker too.
    queryKey: ["areas", "picker", q],
    queryFn: () => search(q),
    enabled: open,
    staleTime: 30_000,
  });

  // Until the results for what's typed arrive, show "Searching…" rather than the previous
  // results, so Enter can't pick an area that doesn't match the text.
  const searching = results.isPending || text.trim() !== q;

  function choose(area: AreaRef | null) {
    onChange(area);
    setOpen(false);
    setText("");
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          ref={triggerRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-body hover:border-muted aria-invalid:border-danger"
        >
          <span className={cn("truncate", !value && "text-muted")}>
            {value?.name ?? t("placeholder")}
          </span>
          <ChevronsUpDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted"
          />
        </PopoverTrigger>
        <PopoverContent
          aria-label={t("searchLabel")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <Command shouldFilter={false} loop label={t("searchLabel")}>
            <CommandInput
              value={text}
              onValueChange={setText}
              placeholder={t("searchPlaceholder")}
              maxLength={100}
            />
            {!searching && results.isError ? (
              // Outside the listbox, which may only hold options.
              <div className="p-2">
                <ProblemAlert
                  message={message(results.error)}
                  requestId={
                    results.error instanceof ApiError
                      ? results.error.requestId
                      : null
                  }
                  retryAfterSeconds={
                    results.error instanceof ApiError
                      ? results.error.retryAfterSeconds
                      : null
                  }
                  onRetry={() => void results.refetch()}
                />
              </div>
            ) : (
              <CommandList label={t("listLabel")}>
                {searching ? (
                  <CommandLoading label={t("loading")}>
                    {t("loading")}
                  </CommandLoading>
                ) : (
                  <>
                    <CommandEmpty>{t("noResults")}</CommandEmpty>
                    {results.data?.items.map((area) => (
                      <CommandItem
                        key={area.id}
                        value={area.id}
                        onSelect={() => choose(area)}
                      >
                        {area.name}
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandList>
            )}
            {!searching && results.data?.hasMore && (
              <p className="border-t border-line px-3 py-2 text-meta text-muted">
                {t("moreHint")}
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            triggerRef.current?.focus();
          }}
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-ice hover:text-navy"
        >
          <XIcon aria-hidden className="size-4" />
          <span className="sr-only">{t("clear", { name: value.name })}</span>
        </button>
      )}
    </div>
  );
}
