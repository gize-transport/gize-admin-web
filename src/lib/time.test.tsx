import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { defaultLocale, timeZone } from "../i18n/config";
import { scheduleTimeSchema, useTimestampFormat } from "./time";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={defaultLocale}
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}

describe("useTimestampFormat", () => {
  it("shows UTC timestamps in Addis Ababa time (UTC+3)", () => {
    const { result } = renderHook(() => useTimestampFormat(), { wrapper });

    // 21:30 UTC on 31 October is 00:30 on 1 November in Addis Ababa.
    // ICU may put a narrow no-break space before AM/PM.
    expect(result.current.dateTime("2026-10-31T21:30:00Z")).toMatch(
      /^Nov 1, 2026, 12:30\sAM$/,
    );
    expect(result.current.date("2026-10-31T21:30:00Z")).toBe("Nov 1, 2026");
  });

  it("returns an empty string for a missing or unreadable timestamp", () => {
    const { result } = renderHook(() => useTimestampFormat(), { wrapper });

    expect(result.current.dateTime(null)).toBe("");
    expect(result.current.date("not a date")).toBe("");
    expect(result.current.day(null)).toBe("");
    expect(result.current.day("not a day")).toBe("");
  });

  it("shows a calendar day as it is, whatever the time zone", () => {
    const { result } = renderHook(() => useTimestampFormat(), { wrapper });

    expect(result.current.day("2026-12-01")).toBe("Dec 1, 2026");
    expect(result.current.day("2026-11-30")).toBe("Nov 30, 2026");
  });
});

describe("scheduleTimeSchema", () => {
  it("accepts HH:MM times of day and keeps them exactly as typed", () => {
    expect(scheduleTimeSchema.parse("06:30")).toBe("06:30");
    expect(scheduleTimeSchema.parse("23:59")).toBe("23:59");
  });

  it.each(["6:30", "24:00", "06:60", "06:30:00", "0630", ""])(
    "refuses %j",
    (value) => {
      expect(scheduleTimeSchema.safeParse(value).success).toBe(false);
    },
  );
});
