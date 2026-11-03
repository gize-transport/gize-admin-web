import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteRequestsScreen } from "@/features/route-requests/route-requests-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RouteRequests");
  return { title: t("metaTitle") };
}

export default function RouteRequestsPage() {
  return (
    // The screen reads its filters, page and open request from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <RouteRequestsScreen />
    </Suspense>
  );
}
