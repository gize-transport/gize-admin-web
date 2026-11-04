import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogScreen } from "@/features/audit-log/audit-log-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AuditLog");
  return { title: t("metaTitle") };
}

export default function AuditLogPage() {
  return (
    // The screen reads its filters and page from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <AuditLogScreen />
    </Suspense>
  );
}
