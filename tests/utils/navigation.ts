import { vi } from "vitest";

/**
 * State behind the `next/navigation` mock. See src/components/data-table/data-table.test.tsx for use
 * with vi.hoisted + vi.mock.
 */
export function createNavigationState() {
  return {
    pathname: "/",
    search: "",
    push: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
    replace: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
    refresh: vi.fn<() => void>(),
  };
}

export type NavigationState = ReturnType<typeof createNavigationState>;

export function mockNavigation(nav: NavigationState) {
  let cached = { search: nav.search, params: new URLSearchParams(nav.search) };
  return {
    usePathname: () => nav.pathname,
    // Same object while the URL is unchanged, like the real hook.
    useSearchParams: () => {
      if (cached.search !== nav.search) {
        cached = {
          search: nav.search,
          params: new URLSearchParams(nav.search),
        };
      }
      return cached.params;
    },
    useRouter: () => ({
      push: nav.push,
      replace: nav.replace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: nav.refresh,
      prefetch: vi.fn(),
    }),
  };
}
