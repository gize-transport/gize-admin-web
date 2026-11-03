"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches now, kept up to date (e.g. "(min-width: 1280px)" for the detail
 * side panel). Null until it is known: on the server and while a server-rendered page hydrates
 * (effects of that first pass run before the real value), so decide nothing on null. False where
 * `matchMedia` doesn't exist.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => null,
  );
}
