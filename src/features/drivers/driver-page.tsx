"use client";

import { useRouter } from "next/navigation";
import { DriverDetail } from "./driver-detail";

/** A driver's own page (`/drivers/[id]`): after a delete it goes back to the list. */
export function DriverPage({ driverId }: { driverId: string }) {
  const router = useRouter();
  return (
    <DriverDetail
      driverId={driverId}
      variant="page"
      onDeleted={() => router.push("/drivers")}
    />
  );
}
