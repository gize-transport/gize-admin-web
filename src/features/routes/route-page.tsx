"use client";

import { useRouter } from "next/navigation";
import { focusDetailWhenOpened } from "@/components/detail/detail-frame";
import { RouteDetail } from "./route-detail";

/**
 * A route's own page (`/routes/[id]`): after a delete it goes back to the list, replacing the
 * page so Back doesn't return to a route that's gone.
 */
export function RoutePage({ routeId }: { routeId: string }) {
  const router = useRouter();
  return (
    <RouteDetail
      routeId={routeId}
      variant="page"
      onDeleted={() => router.replace("/routes")}
      onOpenRoute={(id) => {
        // Its heading takes focus once shown (this page stays hidden in the document).
        focusDetailWhenOpened(id);
        router.push(`/routes/${id}`);
      }}
    />
  );
}
