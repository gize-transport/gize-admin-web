import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffPage } from "@/features/staff/staff-page";

// The member's name is personal data (and needs the signed-in person's token): the tab says
// "Staff".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Staff");
  return { title: t("metaTitle") };
}

async function Member({ params }: PageProps<"/staff/[staffId]">) {
  const { staffId } = await params;
  return <StaffPage staffId={staffId} />;
}

export default function StaffMemberRoute(props: PageProps<"/staff/[staffId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Member {...props} />
    </Suspense>
  );
}
