import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteRequestPage } from "@/features/route-requests/route-request-page";

// The rider's name is personal data (and needs the signed-in person's token): the tab says
// "Route requests".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RouteRequests");
  return { title: t("metaTitle") };
}

async function Request({ params }: PageProps<"/route-requests/[requestId]">) {
  const { requestId } = await params;
  return <RouteRequestPage requestId={requestId} />;
}

export default function RouteRequestRoute(
  props: PageProps<"/route-requests/[requestId]">,
) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Request {...props} />
    </Suspense>
  );
}
