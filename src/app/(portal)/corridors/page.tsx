import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CorridorsScreen } from "@/features/corridors/corridors-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Corridors");
  return { title: t("metaTitle") };
}

export default function CorridorsPage() {
  return (
    // The screen reads its filters and page from the URL, so it renders on the client.
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <CorridorsScreen />
    </Suspense>
  );
}
