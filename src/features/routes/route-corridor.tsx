"use client";

import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";

type CorridorRef = components["schemas"]["CorridorRef"];

/** "Bole → Piassa" on screen, "from Bole to Piassa" to screen readers (the arrow is hidden). */
export function RouteCorridor({ corridor }: { corridor: CorridorRef }) {
  const t = useTranslations("Routes");
  return (
    <>
      {t.rich("corridorName", {
        origin: corridor.origin_area.name,
        destination: corridor.destination_area.name,
        spoken: (chunks) => <span className="sr-only">{chunks}</span>,
        arrow: (chunks) => <span aria-hidden="true">{chunks}</span>,
      })}
    </>
  );
}
