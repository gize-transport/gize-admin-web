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

  return {
    cursor: searchParams.get(CURSOR_PARAM),
    get: (key: string) => searchParams.get(key),
    nextPageHref: (nextCursor: string) =>
      hrefWith({ [CURSOR_PARAM]: nextCursor }),
    firstPageHref: () => hrefWith({ [CURSOR_PARAM]: null }),
    /** Sets or clears a filter. A new filter always starts again from the first page. */
    setFilter: (key: string, value: string | null) =>
      router.push(hrefWith({ [key]: value, [CURSOR_PARAM]: null }), {
        scroll: false,
      }),
  };
}
