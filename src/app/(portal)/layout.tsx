import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";
import { PortalShell } from "@/components/shell/portal-shell";
import {
  SIDEBAR_COOKIE,
  isSidebarCollapsed,
} from "@/components/shell/sidebar-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Every signed-in page (middleware.ts keeps signed-out visitors out): sidebar, account, main.
 * Each screen is drawn in the browser, where its data is: pages render per request (the CSP
 * nonce), and a screen rendered on the server could hydrate after its data arrived and differ.
 * The sidebar opens as the last page left it (a cookie, GZW-082).
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const collapsed = isSidebarCollapsed(
    (await cookies()).get(SIDEBAR_COOKIE)?.value,
  );
  return (
    <PortalShell defaultCollapsed={collapsed}>
      <ClientOnly fallback={<Skeleton className="h-10 w-48" />}>
        {children}
      </ClientOnly>
    </PortalShell>
  );
}
