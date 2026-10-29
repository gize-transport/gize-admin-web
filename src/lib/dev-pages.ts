/**
 * Dev-only pages (e.g. /dev/components) exist under `next dev`, and in production builds made for
 * e2e tests with the server-only build flag GIZE_DEV_PAGES=1. Deployed builds leave it unset → 404.
 */
export function devPagesEnabled() {
  return (
    process.env.NODE_ENV === "development" || process.env.GIZE_DEV_PAGES === "1"
  );
}
