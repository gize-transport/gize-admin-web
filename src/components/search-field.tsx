"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListParams } from "@/components/data-table";

const SEARCH_DELAY_MS = 300;

type SearchFieldProps = {
  /** URL search param the text goes into (and back to the first page). */
  param: string;
  label: string;
  placeholder?: string;
  /** Matches the API's limit for this search. */
  maxLength?: number;
};

/**
 * A list's search box: its text lives in the URL (shareable, survives reload), written after a
 * short pause in typing, or at once when the box loses focus. Clearing the box clears the search.
 */
export function SearchField({
  param,
  label,
  placeholder,
  maxLength = 100,
}: SearchFieldProps) {
  const { get, setFilter } = useListParams();
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const fromUrl = get(param) ?? "";
  const [text, setText] = useState(fromUrl);
  const [lastUrl, setLastUrl] = useState(fromUrl);
  // Values this box wrote that the URL hasn't reached yet. A navigation can finish after more
  // typing, so arriving at one of these must not overwrite the box.
  const [pending, setPending] = useState<string[]>([]);

  if (lastUrl !== fromUrl) {
    setLastUrl(fromUrl);
    const index = pending.indexOf(fromUrl);
    if (index === -1) {
      // The URL changed from elsewhere (Back, "Clear search"): show it.
      setText(fromUrl);
      setPending([]);
    } else {
      setPending(pending.slice(index + 1));
    }
  }

  const latest = pending.at(-1) ?? fromUrl;
  /** Writes what's typed to the URL, unless it's there (or on its way) already. */
  function write() {
    const value = text.trim();
    if (value === latest) return;
    setPending((values) => [...values, value]);
    setFilter(param, value || null, { replace: true });
  }
  useEffect(() => {
    const value = text.trim();
    if (value === latest) return;
    const timer = setTimeout(() => {
      setPending((values) => [...values, value]);
      setFilter(param, value || null, { replace: true });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, latest, param, setFilter]);

  return (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor={`${uid}-search`}>{label}</Label>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          id={`${uid}-search`}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          // Leaving the box (often to open a result) writes now: a write still waiting would
          // land after that click's navigation had started, and undo it.
          onBlur={write}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className="pl-9"
        />
      </div>
    </div>
  );
}
