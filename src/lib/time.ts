import { useFormatter } from "next-intl";
import { useCallback } from "react";
import { z } from "zod";

// architecture.md, "Times": timestamps are UTC and shown in Africa/Addis_Ababa (the time zone
// next-intl is configured with); schedule times are local "HH:MM" and are never converted.

function toDate(timestamp: string | null | undefined) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats API timestamps (`created_at`, …) in Addis Ababa time; "" when missing. */
export function useTimestampFormat() {
  const format = useFormatter();

  const dateTime = useCallback(
    (timestamp: string | null | undefined) => {
      const date = toDate(timestamp);
      return date
        ? format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })
        : "";
    },
    [format],
  );

  const date = useCallback(
    (timestamp: string | null | undefined) => {
      const value = toDate(timestamp);
      return value ? format.dateTime(value, { dateStyle: "medium" }) : "";
    },
    [format],
  );

  return { dateTime, date };
}

/**
 * A route's schedule time as the API sends and accepts it: local Addis Ababa "HH:MM". Show it
 * as it is; never pass it through `Date`. Same pattern as the contract's.
 */
export const scheduleTimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM");
