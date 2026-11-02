import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreasScreen } from "@/features/areas/areas-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Areas");
  return { title: t("metaTitle") };
}

export default function AreasPage() {
  return (
    // The screen reads the search and page from the URL, so it renders on the client.
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <AreasScreen />
    </Suspense>
  );
}
