import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DriversScreen } from "@/features/drivers/drivers-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Drivers");
  return { title: t("metaTitle") };
}

export default function DriversPage() {
  return (
    // The screen reads its filter, page and open driver from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <DriversScreen />
    </Suspense>
  );
}
