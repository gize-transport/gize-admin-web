import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CompaniesScreen } from "@/features/companies/companies-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Companies");
  return { title: t("metaTitle") };
}

export default function CompaniesPage() {
  return (
    // The screen reads its search, filter, page and open company from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <CompaniesScreen />
    </Suspense>
  );
}
