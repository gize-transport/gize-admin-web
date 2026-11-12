import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverPage } from "@/features/drivers/driver-page";

// The driver's name is personal data (and needs the signed-in person's token): the tab says
// "Drivers".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Drivers");
  return { title: t("metaTitle") };
}

async function Driver({ params }: PageProps<"/drivers/[driverId]">) {
  const { driverId } = await params;
  return <DriverPage driverId={driverId} />;
}

export default function DriverRoute(props: PageProps<"/drivers/[driverId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Driver {...props} />
    </Suspense>
  );
}
