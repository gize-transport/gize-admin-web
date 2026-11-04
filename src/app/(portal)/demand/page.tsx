import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DemandScreen } from "@/features/demand/demand-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Demand");
  return { title: t("metaTitle") };
}

export default function DemandPage() {
  return (
    // The screen's dialogs read the URL (pickers, lists) on the client.
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <DemandScreen />
    </Suspense>
  );
}
