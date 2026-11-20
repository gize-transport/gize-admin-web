"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type Ref } from "react";
import { ProblemAlert } from "@/components/problem-alert";
import { Label } from "@/components/ui/label";
import { fetchCorridorBetween } from "@/features/corridors/queries";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { AreaPicker } from "./area-picker";

type AreaRef = components["schemas"]["AreaRef"];
type CorridorRef = components["schemas"]["CorridorRef"];

type Lookup =
  | { state: "idle" }
  | { state: "finding" }
  | { state: "found"; origin: string; destination: string }
  | { state: "none"; origin: string; destination: string }
  | { state: "failed"; error: unknown };

type CorridorFieldProps = {
  /** Prefix for the two pickers' ids. */
  id: string;
  /** Names the pair (a fieldset legend), e.g. "Corridor". */
  legend: string;
  value: CorridorRef | null;
  onChange: (corridor: CorridorRef | null) => void;
  /** The origin picker: react-hook-form's `field.ref`, so `setFocus` reaches the field. */
  ref?: Ref<HTMLButtonElement>;
  onBlur?: () => void;
  invalid?: boolean;
  "aria-describedby"?: string;
  /** For a filter: what an unchosen area says ("Any area"). */
  placeholder?: string;
  /** Hide the legend visually (a filter row has its own heading). */
  legendHidden?: boolean;
  /**
   * In a list toolbar (GZW-076): two compact buttons, "From" and "To", on one line; the legend
   * and labels are for screen readers, and only "no corridor yet" (or a failure) shows below.
   */
  toolbar?: boolean;
  /** In a toolbar, while the corridor in the address is loaded: what the buttons say. */
  loadingLabel?: string;
};

/**
 * Chooses a corridor the way the design system says (origin area + destination area, a corridor
 * has a direction): two area pickers, then the corridor between them is looked up. When there is
 * none yet, says so and links to Corridors. The value is the corridor, or null until one is found.
 */
export function CorridorField({
  id,
  legend,
  value,
  onChange,
  ref,
  onBlur,
  invalid,
  "aria-describedby": describedBy,
  placeholder,
  legendHidden,
  toolbar = false,
  loadingLabel,
}: CorridorFieldProps) {
  const t = useTranslations("CorridorField");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState<AreaRef | null>(
    value?.origin_area ?? null,
  );
  const [destination, setDestination] = useState<AreaRef | null>(
    value?.destination_area ?? null,
  );
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  // Corridors this field reported that its `value` hasn't come back with yet (a URL updates a
  // render or two later). Arriving at one of them is the field's own change; any other value is a
  // change from outside (Back, a cleared filter, a reset form): show it, and drop lookups running.
  const valueId = value?.id ?? null;
  const [shownValue, setShownValue] = useState(valueId);
  const [pending, setPending] = useState<(string | null)[]>([]);
  const [outsideChanges, setOutsideChanges] = useState(0);
  if (valueId !== shownValue) {
    setShownValue(valueId);
    const index = pending.indexOf(valueId);
    if (index === -1) {
      setPending([]);
      setOrigin(value?.origin_area ?? null);
      setDestination(value?.destination_area ?? null);
      setLookup({ state: "idle" });
      setOutsideChanges((count) => count + 1);
    } else {
      setPending(pending.slice(index + 1));
    }
  }
  // Only the latest choice's lookup may report (an earlier one can answer later); a change from
  // outside cancels them all.
  const latest = useRef(0);
  useEffect(() => {
    latest.current += 1;
  }, [outsideChanges]);
  const current = pending.length > 0 ? pending[pending.length - 1] : valueId;

  function report(corridor: CorridorRef | null) {
    setPending((reported) => [...reported, corridor?.id ?? null]);
    onChange(corridor);
  }

  async function choose(
    nextOrigin: AreaRef | null,
    nextDestination: AreaRef | null,
  ) {
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    const attempt = ++latest.current;
    // The old pair's corridor no longer applies while the new one is looked up.
    if (current !== null) report(null);
    if (!nextOrigin || !nextDestination) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "finding" });
    try {
      const corridor = await fetchCorridorBetween(
        queryClient,
        nextOrigin.id,
        nextDestination.id,
      );
      if (attempt !== latest.current) return;
      if (corridor) {
        setLookup({
          state: "found",
          origin: corridor.origin_area.name,
          destination: corridor.destination_area.name,
        });
        report(corridor);
      } else {
        setLookup({
          state: "none",
          origin: nextOrigin.name,
          destination: nextDestination.name,
        });
      }
    } catch (error) {
      if (attempt === latest.current) setLookup({ state: "failed", error });
    }
  }

  const statusId = `${id}-status`;
  const described =
    [describedBy, lookup.state === "none" ? statusId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const short = (label: string) =>
    loadingLabel ? `${label}: ${loadingLabel}` : label;

  return (
    <fieldset
      className={toolbar ? "flex flex-wrap items-center gap-2" : "grid gap-2"}
    >
      <legend
        className={cn(
          "mb-1 text-table font-semibold text-ink",
          (legendHidden || toolbar) && "sr-only",
        )}
      >
        {legend}
      </legend>
      <div
        className={
          toolbar
            ? "flex flex-wrap items-center gap-2"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        <div className={toolbar ? "flex" : "grid gap-1.5"}>
          <Label
            htmlFor={`${id}-origin`}
            className={toolbar ? "sr-only" : undefined}
          >
            {t("originLabel")}
          </Label>
          <AreaPicker
            id={`${id}-origin`}
            ref={ref}
            onBlur={onBlur}
            value={origin}
            onChange={(area) => void choose(area, destination)}
            placeholder={placeholder}
            invalid={invalid}
            aria-describedby={described}
            toolbarLabel={toolbar ? short(t("originShort")) : undefined}
            // Blue only while a corridor filters the list, not for one end alone.
            active={value !== null}
          />
        </div>
        <div className={toolbar ? "flex" : "grid gap-1.5"}>
          <Label
            htmlFor={`${id}-destination`}
            className={toolbar ? "sr-only" : undefined}
          >
            {t("destinationLabel")}
          </Label>
          <AreaPicker
            id={`${id}-destination`}
            value={destination}
            onChange={(area) => void choose(origin, area)}
            placeholder={placeholder}
            invalid={invalid}
            aria-describedby={described}
            toolbarLabel={toolbar ? short(t("destinationShort")) : undefined}
            active={value !== null}
          />
        </div>
      </div>
      <div
        id={statusId}
        role="status"
        className={cn(
          "text-table text-muted",
          // In a toolbar only "no corridor yet" shows (on a line of its own, like a failure); the
          // rest is read out.
          toolbar && (lookup.state === "none" ? "basis-full" : "sr-only"),
        )}
      >
        {lookup.state === "finding" && t("finding")}
        {lookup.state === "found" &&
          t("found", {
            origin: lookup.origin,
            destination: lookup.destination,
          })}
        {lookup.state === "none" && (
          <span className="text-danger">
            {t("none", {
              origin: lookup.origin,
              destination: lookup.destination,
            })}{" "}
            <Link
              href="/corridors"
              className="font-semibold text-royal underline underline-offset-4"
            >
              {t("addCorridor")}
            </Link>
          </span>
        )}
      </div>
      {lookup.state === "failed" && (
        <div className={toolbar ? "basis-full" : undefined}>
          <ProblemAlert
            message={message(lookup.error)}
            requestId={
              lookup.error instanceof ApiError ? lookup.error.requestId : null
            }
            retryAfterSeconds={
              lookup.error instanceof ApiError
                ? lookup.error.retryAfterSeconds
                : null
            }
            onRetry={() => void choose(origin, destination)}
          />
        </div>
      )}
    </fieldset>
  );
}
