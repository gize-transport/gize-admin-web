import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffScreen } from "@/features/staff/staff-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Staff");
  return { title: t("metaTitle") };
}

export default function StaffListPage() {
  return (
    // The screen reads its filters, page and open member from the URL (client side).
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <StaffScreen />
    </Suspense>
  );
}
