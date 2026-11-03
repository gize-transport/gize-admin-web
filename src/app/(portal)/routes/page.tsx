import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoutesScreen } from "@/features/routes/routes-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Routes");
  return { title: t("metaTitle") };
}

export default function RoutesPage() {
  return (
    // The screen reads its search, filters, page and open route from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <RoutesScreen />
    </Suspense>
  );
}
