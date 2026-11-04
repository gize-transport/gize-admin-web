"use client";

import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/status-pill";
import type { components } from "@/lib/api/schema";

type StaffRead = components["schemas"]["StaffRead"];

/** Deactivated, else Pending until their first sign-in, else Active (design-system.md). */
export function staffStatus(
  member: Pick<StaffRead, "is_active" | "first_signed_in_at">,
) {
  if (!member.is_active) return "deactivated" as const;
  return member.first_signed_in_at === null
    ? ("pending" as const)
    : ("active" as const);
}

export function StaffStatusPill({
  member,
}: {
  member: Pick<StaffRead, "is_active" | "first_signed_in_at">;
}) {
  const t = useTranslations("Staff");
  const status = staffStatus(member);
  return (
    <StatusPill
      tone={
        status === "active"
          ? "success"
          : status === "pending"
            ? "waiting"
            : "neutral"
      }
    >
      {t(
        status === "active"
          ? "statusActive"
          : status === "pending"
            ? "statusPending"
            : "statusDeactivated",
      )}
    </StatusPill>
  );
}
