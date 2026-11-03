"use client";

import { useTranslations } from "next-intl";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import type { components } from "@/lib/api/schema";

type RouteRead = components["schemas"]["RouteRead"];

const tones: Record<RouteRead["status"], StatusTone> = {
  draft: "neutral",
  forming: "waiting",
  active: "success",
  paused: "neutral",
};

/** A route's status (design-system.md): a forming route also shows its launch progress. */
export function RouteStatusPill({
  route,
}: {
  route: Pick<RouteRead, "status" | "reserved" | "launch_minimum">;
}) {
  const t = useTranslations("RouteStatus");
  const label =
    route.status !== "forming"
      ? t(route.status)
      : route.launch_minimum === null
        ? t("formingNoMinimum")
        : t("forming", {
            reserved: route.reserved,
            minimum: route.launch_minimum,
          });
  return <StatusPill tone={tones[route.status]}>{label}</StatusPill>;
}
