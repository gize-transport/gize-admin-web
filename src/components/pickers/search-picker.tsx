"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";
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
import { toolbarButtonClass } from "@/components/data-table/toolbar-button";
import { ProblemAlert } from "@/components/problem-alert";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 250;

/** Something a picker offers: the API's `…Ref` (id and name). */
export type PickerOption = { id: string; name: string };

/** What a picker search returns: the first matches, and whether more match. */
export type PickerResult<T extends PickerOption> = {
  items: T[];
  hasMore: boolean;
};

/** The picker's words, from its own messages (AreaPicker, CompanyPicker…). */
export type PickerLabels = {
  placeholder: string;
  searchLabel: string;
  searchPlaceholder: string;
  listLabel: string;
  loading: string;
  noResults: string;
  moreHint: string;
  clear: (name: string) => string;
};

/** The props every picker built on SearchPicker takes (AreaPicker, CompanyPicker…). */
export type PickerFieldProps<T extends PickerOption> = {
  /** For the field's <label htmlFor>. */
  id?: string;
  /** The trigger button: react-hook-form's `field.ref`, so `setFocus` reaches the picker. */
  ref?: Ref<HTMLButtonElement>;
  /** react-hook-form's `field.onBlur` (marks the field touched). */
  onBlur?: () => void;
  value: T | null;
  onChange: (option: T | null) => void;
  /** Shown while nothing is chosen, instead of the picker's own placeholder (e.g. "Any area"). */
  placeholder?: string;
  /** Marks the field invalid (form errors). */
  invalid?: boolean;
  /**
   * Can't be used now (e.g. a list that's full): stays focusable, says so, doesn't open. Say why
   * with `aria-describedby`.
   */
  disabled?: boolean;
  "aria-describedby"?: string;
  /**
   * In a list toolbar (GZW-076): a compact button showing this short name ("Company"), then
   * "Company: Addis Brewery" once chosen. The field's own label stays its accessible name.
   */
  toolbarLabel?: string;
  /** In a toolbar: whether its filter is on, when that isn't simply "something is chosen". */
  active?: boolean;
  /**
   * Where the options come from; each picker defaults to its API list. Tests and the gallery
   * pass their own (one source per page: the results are cached by the search text only).
   */
  search?: (q: string) => Promise<PickerResult<T>>;
};

type SearchPickerProps<T extends PickerOption> = Omit<
  PickerFieldProps<T>,
  "search"
> & {
  search: (q: string) => Promise<PickerResult<T>>;
  /**
   * Cache key prefix under the entity's own key (e.g. ["areas", "picker"]), so adding, renaming
   * or deleting one refreshes the picker too.
   */
  queryKey: readonly string[];
  labels: PickerLabels;
};

/**
 * Chooses one of the API's records, never free text (design-system.md, "Pickers"): a button
 * showing the choice opens a search box with matches; arrow keys and Enter pick one. The pickers
 * (AreaPicker, CompanyPicker…) are thin wrappers that give it their search and words.
 */
export function SearchPicker<T extends PickerOption>({
  id,
  ref,
  onBlur,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
  "aria-describedby": describedBy,
  toolbarLabel,
  active,
  search,
  queryKey,
  labels,
}: SearchPickerProps<T>) {
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
    queryKey: [...queryKey, q],
    queryFn: () => search(q),
    enabled: open,
    staleTime: 30_000,
  });

  // Until the results for what's typed arrive, show "Searching…" rather than the previous
  // results, so Enter can't pick an option that doesn't match the text.
  const searching = results.isPending || text.trim() !== q;

  function choose(option: T | null) {
    onChange(option);
    setOpen(false);
    setText("");
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={(next) => setOpen(next && !disabled)}>
        <PopoverTrigger
          ref={(element) => {
            triggerRef.current = element;
            if (typeof ref === "function") return ref(element);
            if (ref) ref.current = element;
          }}
          id={id}
          onBlur={onBlur}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={invalid || undefined}
          aria-disabled={disabled || undefined}
          aria-describedby={describedBy}
          data-active={toolbarLabel && (active ?? value) ? "" : undefined}
          className={
            toolbarLabel
              ? toolbarButtonClass
              : "flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-body hover:border-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-70 aria-invalid:border-danger"
          }
        >
          {toolbarLabel ? (
            <>
              <span className="truncate">
                {value ? `${toolbarLabel}: ${value.name}` : toolbarLabel}
              </span>
              <ChevronDownIcon aria-hidden />
            </>
          ) : (
            <>
              <span className={cn("truncate", !value && "text-muted")}>
                {value?.name ?? placeholder ?? labels.placeholder}
              </span>
              <ChevronsUpDownIcon
                aria-hidden
                className="size-4 shrink-0 text-muted"
              />
            </>
          )}
        </PopoverTrigger>
        <PopoverContent
          aria-label={labels.searchLabel}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <Command shouldFilter={false} loop label={labels.searchLabel}>
            <CommandInput
              value={text}
              onValueChange={setText}
              placeholder={labels.searchPlaceholder}
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
              <CommandList label={labels.listLabel}>
                {searching ? (
                  <CommandLoading label={labels.loading}>
                    {labels.loading}
                  </CommandLoading>
                ) : (
                  <>
                    <CommandEmpty>{labels.noResults}</CommandEmpty>
                    {results.data?.items.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.id}
                        onSelect={() => choose(option)}
                      >
                        {option.name}
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandList>
            )}
            {!searching && results.data?.hasMore && (
              <p className="border-t border-line px-3 py-2 text-meta text-muted">
                {labels.moreHint}
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
          className={cn(
            "grid shrink-0 place-items-center rounded-lg text-muted hover:bg-ice hover:text-navy",
            toolbarLabel ? "size-9" : "size-10",
          )}
        >
          <XIcon aria-hidden className="size-4" />
          <span className="sr-only">{labels.clear(value.name)}</span>
        </button>
      )}
    </div>
  );
}
