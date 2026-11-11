"use client";

import { useRouter } from "next/navigation";
import { RiderDetail } from "./rider-detail";

/**
 * A rider's own page (`/riders/[id]`): after a delete it goes back to the list, replacing the page
 * so Back doesn't return to a rider who's gone.
 */
export function RiderPage({ riderId }: { riderId: string }) {
  const router = useRouter();
  return (
    <RiderDetail
      riderId={riderId}
      variant="page"
      onDeleted={() => router.replace("/riders")}
    />
  );
}
