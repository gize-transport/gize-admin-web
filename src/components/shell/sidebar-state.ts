/**
 * Whether the sidebar is collapsed, kept in a cookie so the server draws the next page the same
 * way (no flash of the open sidebar). A display preference only: no personal data.
 */
export const SIDEBAR_COOKIE = "gize_sidebar";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** From the cookie's value as the server reads it. */
export function isSidebarCollapsed(value: string | undefined) {
  return value === "collapsed";
}

export function saveSidebarCollapsed(collapsed: boolean) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  // Expanded is the default, so it just clears the cookie.
  document.cookie = collapsed
    ? `${SIDEBAR_COOKIE}=collapsed; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`
    : `${SIDEBAR_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}
