"use client";

import { useTranslations } from "next-intl";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import type { components } from "@/lib/api/schema";

type RouteRequestRead = components["schemas"]["RouteRequestRead"];
type AreaRef = components["schemas"]["AreaRef"];

const tones: Record<RouteRequestRead["status"], StatusTone> = {
  new: "waiting",
  matched: "neutral",
  fulfilled: "success",
  declined: "danger",
};

/** A request's status (design-system.md): a matched one names its route ("Matched · R-14"). */
export function RequestStatusPill({
  request,
}: {
  request: Pick<RouteRequestRead, "status" | "matched_route">;
}) {
  const t = useTranslations("RequestStatus");
  const label =
    request.status === "matched" && request.matched_route
      ? t("matched", { code: request.matched_route.code })
      : t(request.status === "matched" ? "matchedAny" : request.status);
  return <StatusPill tone={tones[request.status]}>{label}</StatusPill>;
}

/**
 * What a request asks for: "Ayat → Lebu (not listed)" (to screen readers "from Ayat to …"), or
 * "Route B-07".
 */
export function AskedFor({
  request,
}: {
  request: Pick<
    RouteRequestRead,
    | "kind"
    | "route"
    | "from_area"
    | "from_area_name"
    | "to_area"
    | "to_area_name"
  >;
}) {
  const t = useTranslations("RouteRequests");
  if (request.kind === "route") {
    return <>{t("askedRoute", { code: request.route?.code ?? "–" })}</>;
  }
  const end = (area: AreaRef | null, name: string | null) =>
    area?.name ?? (name === null ? "–" : t("notListed", { name }));
  return (
    <>
      {t.rich("askedAreas", {
        from: end(request.from_area, request.from_area_name),
        to: end(request.to_area, request.to_area_name),
        spoken: (chunks) => <span className="sr-only">{chunks}</span>,
        arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
      })}
    </>
  );
}

/** "Adult", or "Student · school". */
export function riderLabel(
  request: Pick<RouteRequestRead, "rider_type" | "school_name">,
  t: ReturnType<typeof useTranslations<"RouteRequests">>,
) {
  if (request.rider_type === "adult") return t("riderAdult");
  return request.school_name
    ? t("riderStudentAt", { school: request.school_name })
    : t("riderStudent");
}
