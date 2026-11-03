import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyPage } from "@/features/companies/company-page";

// The company's name needs the signed-in person's token, so the tab says "Companies".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Companies");
  return { title: t("metaTitle") };
}

async function Company({ params }: PageProps<"/companies/[companyId]">) {
  const { companyId } = await params;
  return <CompanyPage companyId={companyId} />;
}

export default function CompanyRoute(
  props: PageProps<"/companies/[companyId]">,
) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Company {...props} />
    </Suspense>
  );
}
