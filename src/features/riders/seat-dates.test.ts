import { describe, expect, it } from "vitest";
import { addDays, latestDay, monthEnds, startMonths } from "./seat-dates";

describe("seat dates", () => {
  it("offers the 1sts from the next one to this month next year", () => {
    const months = startMonths("2026-11-11");
    expect(months[0]).toBe("2026-12-01");
    expect(months.at(-1)).toBe("2027-11-01");
    expect(months).toHaveLength(12);
  });

  it("starts today when today is the 1st", () => {
    const months = startMonths("2026-12-01");
    expect(months[0]).toBe("2026-12-01");
    expect(months.at(-1)).toBe("2027-12-01");
    expect(months).toHaveLength(13);
  });

  it("offers month ends from this month's, within a year", () => {
    const ends = monthEnds("2026-11-11");
    expect(ends[0]).toBe("2026-11-30");
    expect(ends).toContain("2027-02-28");
    expect(ends.at(-1)).toBe("2027-10-31");
    expect(monthEnds("2026-11-30").at(-1)).toBe("2027-11-30");
  });

  it("counts days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(latestDay("2026-11-11")).toBe("2027-11-11");
  });
});
