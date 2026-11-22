import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OpenOffersScreen } from "@/features/offers/open-offers-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OpenOffers");
  return { title: t("metaTitle") };
}

export default function OffersPage() {
  return (
    // The screen reads its page from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <OpenOffersScreen />
    </Suspense>
  );
}
