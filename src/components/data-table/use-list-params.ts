"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

/** Search param that holds the API's opaque `next_cursor` for the current page. */
export const CURSOR_PARAM = "cursor";

/**
 * The URL a list navigation last asked for, until the page's URL next changes. There is one URL,
 * so it's shared by every list control on the page. Without it, a navigation started from an
 * older render (the search box writes after a pause in typing) would build on the URL as it was
 * then, and undo one made meanwhile (a row opened in the side panel).
 */
let intended: { pathname: string; search: string } | null = null;

/**
 * List state (filters and cursor) lives in the URL, so a list can be reloaded, shared and navigated
 * with the browser's Back button (docs/architecture.md → Data fetching).
 */
export function useListParams() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Once the URL changes (a navigation landed, Back) it's the source again; also when a list
  // mounts (a fresh page).
  const search = searchParams.toString();
  useEffect(() => {
    intended = null;
  }, [pathname, search]);

  /** A link on the page: built from the URL as it's shown (render time). */
  const hrefWith = useCallback(
    (changes: Record<string, string | null>) =>
      buildHref(pathname, searchParams.toString(), changes),
    [pathname, searchParams],
  );

  /** Goes to the URL with `changes`, built on the latest one asked for (see `intended`). */
  const navigate = useCallback(
    (changes: Record<string, string | null>, replace: boolean) => {
      const base =
        intended?.pathname === pathname
          ? intended.search
          : searchParams.toString();
      const href = buildHref(pathname, base, changes);
      intended = { pathname, search: href.split("?")[1] ?? "" };
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router, searchParams],
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
      navigate({ ...changes, [CURSOR_PARAM]: null }, Boolean(options?.replace));
    },
    [navigate],
  );

  /**
   * Sets or clears params that aren't filters (e.g. the record whose details are open), on the
   * same page of the list. Adds a history entry, so Back undoes it, unless `replace`.
   */
  const setParams = useCallback(
    (
      changes: Record<string, string | null>,
      options?: { replace?: boolean },
    ) => {
      navigate(changes, Boolean(options?.replace));
    },
    [navigate],
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
    setParams,
  };
}

function buildHref(
  pathname: string,
  search: string,
  changes: Record<string, string | null>,
) {
  const next = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
