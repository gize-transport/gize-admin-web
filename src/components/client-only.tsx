"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * Renders `children` only in the browser; the server and the hydrating render show `fallback`.
 * For screens whose markup depends on data that only the browser fetches (the signed-in role,
 * TanStack queries): rendered on the server, a part that hydrates late would meet data that has
 * arrived meanwhile and differ from its server HTML (React error #418).
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return inBrowser ? children : fallback;
}
