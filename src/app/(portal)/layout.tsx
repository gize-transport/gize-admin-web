import type { ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";
import { PortalShell } from "@/components/shell/portal-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Every signed-in page (middleware.ts keeps signed-out visitors out): sidebar, account, main.
 * Each screen is drawn in the browser, where its data is: pages render per request (the CSP
 * nonce), and a screen rendered on the server could hydrate after its data arrived and differ.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell>
      <ClientOnly fallback={<Skeleton className="h-10 w-48" />}>
        {children}
      </ClientOnly>
    </PortalShell>
  );
}
