"use client";

import { useRouter } from "next/navigation";
import { RouteRequestDetail } from "./route-request-detail";

/**
 * A route request's own page (`/route-requests/[id]`): after a delete it goes back to the list,
 * replacing the page so Back doesn't return to a request that's gone.
 */
export function RouteRequestPage({ requestId }: { requestId: string }) {
  const router = useRouter();
  return (
    <RouteRequestDetail
      requestId={requestId}
      variant="page"
      onDeleted={() => router.replace("/route-requests")}
    />
  );
}
