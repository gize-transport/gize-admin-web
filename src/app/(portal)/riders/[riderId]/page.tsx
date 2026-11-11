import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RiderPage } from "@/features/riders/rider-page";

// The rider's name is personal data (and needs the signed-in person's token): the tab says
// "Riders".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Riders");
  return { title: t("metaTitle") };
}

async function Rider({ params }: PageProps<"/riders/[riderId]">) {
  const { riderId } = await params;
  return <RiderPage riderId={riderId} />;
}

export default function RiderRoute(props: PageProps<"/riders/[riderId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Rider {...props} />
    </Suspense>
  );
}
