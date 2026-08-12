import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, isoFortnightStart, isoWeekStart } from "./date-utils";

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

describe("isoFortnightStart", () => {
  // Anchor "2026-08-12" (a Wednesday) snaps to Monday 2026-08-10, so fortnight 0 covers
  // 2026-08-10 .. 2026-08-23 and fortnight 1 starts 2026-08-24.
  const anchor = "2026-08-12";

  it("groups every date in the anchor's own fortnight to the same start", () => {
    expect(isoFortnightStart("2026-08-10", anchor)).toBe("2026-08-10"); // week 0, Monday
    expect(isoFortnightStart("2026-08-16", anchor)).toBe("2026-08-10"); // week 0, Sunday
    expect(isoFortnightStart("2026-08-17", anchor)).toBe("2026-08-10"); // week 1, Monday
    expect(isoFortnightStart("2026-08-23", anchor)).toBe("2026-08-10"); // week 1, Sunday
  });

  it("moves to the next fortnight start at the 14-day boundary", () => {
    expect(isoFortnightStart("2026-08-24", anchor)).toBe("2026-08-24");
  });

  it("handles dates before the anchor", () => {
    expect(isoFortnightStart("2026-08-05", anchor)).toBe("2026-07-27");
    expect(isoFortnightStart("2026-08-09", anchor)).toBe("2026-07-27");
  });

  it("gives the same result regardless of which day of the week the anchor itself falls on", () => {
    // Both a Monday anchor and a Thursday anchor represent "the same fortnight cycle" once
    // snapped to their own Monday, so results shouldn't depend on the anchor's weekday.
    expect(isoFortnightStart("2026-08-24", "2026-08-10")).toBe("2026-08-24");
    expect(isoFortnightStart("2026-08-24", "2026-08-13")).toBe("2026-08-24");
  });

  it("rolls over a year boundary", () => {
    expect(isoFortnightStart("2027-01-01", anchor)).toBe("2026-12-28");
  });
});
