"use client";

import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/status-pill";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { timeZone } from "@/i18n/config";

type RiderListItem = components["schemas"]["RiderListItem"];
type SeatRef = components["schemas"]["SeatRef"];

/** Today in Addis Ababa as "YYYY-MM-DD", to compare with a seat's days. */
export function todayInAddis(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** "Adult", "Student", or "Company". */
export function riderTypeLabel(
  riderType: RiderListItem["rider_type"],
  t: ReturnType<typeof useTranslations<"Riders">>,
) {
  if (riderType === "corporate") return t("typeCompany");
  return t(riderType === "student" ? "typeStudent" : "typeAdult");
}

/** "Round trip", "Morning only + Saturday"; null for company riders (the company is billed). */
export function planLabel(
  rider: Pick<RiderListItem, "plan" | "saturday_addon">,
  t: ReturnType<typeof useTranslations<"Riders">>,
) {
  if (rider.plan === null) return null;
  const plan = t(
    rider.plan === "round_trip"
      ? "planRoundTrip"
      : rider.plan === "morning"
        ? "planMorning"
        : "planEvening",
  );
  return rider.saturday_addon ? t("planWithSaturday", { plan }) : plan;
}

/** A seat's state: riding (a place on an active route) or reserved (a forming route). */
export function SeatPill({ seat }: { seat: Pick<SeatRef, "status"> }) {
  const t = useTranslations("Riders");
  return seat.status === "active" ? (
    <StatusPill tone="success">{t("seatRiding")}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{t("seatReserved")}</StatusPill>
  );
}

/** When a seat starts or ends, if that isn't simply "now and ongoing": "From Dec 1, 2026". */
export function useSeatDates() {
  const t = useTranslations("Riders");
  const { day } = useTimestampFormat();
  return (seat: Pick<SeatRef, "start_date" | "end_date">, today: string) => {
    const parts: string[] = [];
    if (seat.start_date > today) {
      parts.push(t("seatFrom", { date: day(seat.start_date) }));
    }
    if (seat.end_date !== null) {
      parts.push(t("seatUntil", { date: day(seat.end_date) }));
    }
    return parts.join(" · ");
  };
}

/**
 * A rider's seat in a list row: "R-03 · Riding", when it starts or ends, and the route they move
 * to next. No seat: "No seat".
 */
export function SeatSummary({
  rider,
}: {
  rider: Pick<RiderListItem, "seat" | "next_seat">;
}) {
  const t = useTranslations("Riders");
  const { day } = useTimestampFormat();
  const seatDates = useSeatDates();
  const { seat, next_seat: next } = rider;
  if (seat === null) return <span className="text-muted">{t("noSeat")}</span>;
  const dates = seatDates(seat, todayInAddis());
  return (
    <span className="grid gap-0.5">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">{seat.route_code}</span>
        <SeatPill seat={seat} />
      </span>
      {dates && <span className="text-meta text-muted">{dates}</span>}
      {next !== null && (
        <span className="text-meta text-muted">
          {t("movingTo", { code: next.route_code, date: day(next.start_date) })}
        </span>
      )}
    </span>
  );
}
