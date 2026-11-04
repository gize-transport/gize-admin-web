"use client";

import { StaffDetail } from "./staff-detail";

/** A staff member's own page (`/staff/[id]`). */
export function StaffPage({ staffId }: { staffId: string }) {
  return <StaffDetail staffId={staffId} variant="page" />;
}
