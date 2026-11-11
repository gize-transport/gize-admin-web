import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RidersScreen } from "@/features/riders/riders-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Riders");
  return { title: t("metaTitle") };
}

export default function RidersPage() {
  return (
    // The screen reads its filters, page and open rider from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <RidersScreen />
    </Suspense>
  );
}
