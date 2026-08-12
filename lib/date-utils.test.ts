import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, isoWeekStart } from "./date-utils";

describe("dayOfWeek", () => {
  it("identifies each day of a known week correctly", () => {
    // 2026-08-10 is a Monday (confirmed via `date -j -f "%Y-%m-%d"` during development).
    expect(dayOfWeek("2026-08-09")).toBe(0); // Sunday
    expect(dayOfWeek("2026-08-10")).toBe(1); // Monday
    expect(dayOfWeek("2026-08-11")).toBe(2); // Tuesday
    expect(dayOfWeek("2026-08-15")).toBe(6); // Saturday
  });

  it("is independent of the runtime's local timezone", () => {
    // Regression test for the original bug: new Date(startedAt).getUTCDay() on a bare
    // datetime string silently used the server's local offset (Australia/Brisbane, UTC+10)
    // and misclassified a Monday shift as Sunday. dayOfWeek must not repeat that.
    const originalTZ = process.env.TZ;
    try {
      process.env.TZ = "Australia/Brisbane";
      expect(dayOfWeek("2026-08-10")).toBe(1); // Monday
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14, the other extreme
      expect(dayOfWeek("2026-08-10")).toBe(1); // Monday
    } finally {
      process.env.TZ = originalTZ;
    }
  });

  it("handles a leap-year boundary date", () => {
    expect(dayOfWeek("2028-02-29")).toBe(2); // Tuesday
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-08-10", 3)).toBe("2026-08-13");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("subtracts with a negative offset", () => {
    expect(addDays("2026-08-10", -3)).toBe("2026-08-07");
  });
});

describe("isoWeekStart", () => {
  it("returns the same Monday for every day in that week", () => {
    // Week of 2026-08-10 (Mon) .. 2026-08-16 (Sun)
    expect(isoWeekStart("2026-08-10")).toBe("2026-08-10"); // Monday itself
    expect(isoWeekStart("2026-08-13")).toBe("2026-08-10"); // Thursday
    expect(isoWeekStart("2026-08-16")).toBe("2026-08-10"); // Sunday wraps back, not forward
  });

  it("rolls over into the previous month/year when the week start crosses a boundary", () => {
    // 2027-01-01 is a Friday; its week starts Monday 2026-12-28.
    expect(isoWeekStart("2027-01-01")).toBe("2026-12-28");
  });
});
