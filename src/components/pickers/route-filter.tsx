"use client";

import { useId, useState } from "react";
import { useListParams } from "@/components/data-table";
import { isNotFound } from "@/components/detail/detail-frame";
import { Label } from "@/components/ui/label";
import { useRoute } from "@/features/routes/queries";
import type { components } from "@/lib/api/schema";
import { RoutePicker } from "./route-picker";

type RouteRef = components["schemas"]["RouteRef"];

type RouteFilterProps = {
  routeId: string | null;
  labels: {
    label: string;
    anyRoute: string;
    loading: string;
    unknownRoute: string;
    routeUnavailable: string;
  };
};

/**
 * A list's route filter, kept in the URL as the route's id (`route_id`). A route chosen here is
 * shown at once; one from the address is loaded to show its code.
 */
export function RouteFilter({ routeId, labels }: RouteFilterProps) {
  // Unique ids: Next can keep earlier pages in the document (see SearchField).
  const uid = useId();
  const { setFilter } = useListParams();
  const [picked, setPicked] = useState<RouteRef | null>(null);
  const known = picked !== null && picked.id === routeId ? picked : null;
  const route = useRoute(known === null ? routeId : null);

  let value: RouteRef | null = known;
  if (routeId !== null && known === null && route.data) {
    value = { id: route.data.id, code: route.data.code };
  }
  const unknown = routeId !== null && known === null && route.isError;
  const loading = routeId !== null && value === null && !unknown;

  return (
    // In a list toolbar (GZW-076): a compact button; "unknown route" on a line of its own.
    <div className="contents">
      <Label htmlFor={`${uid}-route`} className="sr-only">
        {labels.label}
      </Label>
      <RoutePicker
        id={`${uid}-route`}
        toolbarLabel={
          loading ? `${labels.label}: ${labels.loading}` : labels.label
        }
        value={value}
        placeholder={loading ? labels.loading : labels.anyRoute}
        aria-describedby={unknown ? `${uid}-route-unknown` : undefined}
        onChange={(next) => {
          setPicked(next);
          setFilter("route_id", next?.id ?? null);
        }}
      />
      {unknown && (
        <p
          id={`${uid}-route-unknown`}
          className="basis-full text-table text-muted"
        >
          {isNotFound(route.error)
            ? labels.unknownRoute
            : labels.routeUnavailable}
        </p>
      )}
    </div>
  );
}
