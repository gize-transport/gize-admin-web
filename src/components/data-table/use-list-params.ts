"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Search param that holds the API's opaque `next_cursor` for the current page. */
export const CURSOR_PARAM = "cursor";

/**
 * List state (filters and cursor) lives in the URL, so a list can be reloaded, shared and navigated
 * with the browser's Back button (docs/architecture.md → Data fetching).
 */
export function useListParams() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const hrefWith = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  /**
   * Sets or clears filters in one navigation. A new filter always starts again from the first
   * page. `replace` changes the current history entry instead of adding one (a search box as
   * staff type).
   */
  const setFilters = useCallback(
    (
      changes: Record<string, string | null>,
      options?: { replace?: boolean },
    ) => {
      const href = hrefWith({ ...changes, [CURSOR_PARAM]: null });
      if (options?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [router, hrefWith],
  );

  /** Sets or clears one filter (see setFilters). */
  const setFilter = useCallback(
    (key: string, value: string | null, options?: { replace?: boolean }) =>
      setFilters({ [key]: value }, options),
    [setFilters],
  );

  return {
    cursor: searchParams.get(CURSOR_PARAM),
    get: (key: string) => searchParams.get(key),
    nextPageHref: (nextCursor: string) =>
      hrefWith({ [CURSOR_PARAM]: nextCursor }),
    firstPageHref: () => hrefWith({ [CURSOR_PARAM]: null }),
    setFilter,
    setFilters,
  };
}
