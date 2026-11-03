import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoutePage } from "@/features/routes/route-page";

// The route's code needs the signed-in person's token, so the tab says "Routes".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Routes");
  return { title: t("metaTitle") };
}

async function Route({ params }: PageProps<"/routes/[routeId]">) {
  const { routeId } = await params;
  return <RoutePage routeId={routeId} />;
}

export default function RouteRoute(props: PageProps<"/routes/[routeId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-48" />}>
      <Route {...props} />
    </Suspense>
  );
}
