import type { ReactNode } from "react";
import { PortalShell } from "@/components/shell/portal-shell";

/** Every signed-in page (middleware.ts keeps signed-out visitors out): sidebar, account, main. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
