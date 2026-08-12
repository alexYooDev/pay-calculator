import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateTemplate, ShiftEntry } from "./types";

vi.mock("./holidays", () => ({
  isPublicHoliday: vi.fn(),
}));

const { isPublicHoliday } = await import("./holidays");
const { calculateShiftPay, calculatePay } = await import("./calculate-pay");

const isPublicHolidayMock = vi.mocked(isPublicHoliday);

function rate(overrides: Partial<RateTemplate> = {}): RateTemplate {
  return {
    id: "rate-1",
    employer: "Woolworths",
    baseRate: 30,
    employmentType: "casual",
    region: "AU-QLD",
    loading: [
      { type: "casual", percentage: 25 },
      { type: "saturday", percentage: 25 },
      { type: "sunday", percentage: 50 },
      { type: "public_holiday", percentage: 150 },
    ],
    payFrequency: "fortnightly",
    payCycleAnchor: "2026-08-12",
    ...overrides,
  };
}

function shift(overrides: Partial<ShiftEntry> = {}): ShiftEntry {
  return { id: "s1", startedAt: "2026-08-10T09:00:00", endedAt: "2026-08-10T17:00:00", rate: "rate-1", ...overrides };
}

beforeEach(() => {
  isPublicHolidayMock.mockReset();
  isPublicHolidayMock.mockResolvedValue(false);
});

describe("calculateShiftPay", () => {
  it("computes hours and base pay, applying only the casual loading on an ordinary weekday", async () => {
    // 2026-08-10 is a Monday.
    const b = await calculateShiftPay(shift(), rate());
    expect(b.hours).toBe(8);
    expect(b.basePay).toBe(240);
    expect(b.appliedLoadings.map((l) => l.type)).toEqual(["casual"]);
    expect(b.totalPay).toBe(300); // 240 + 25%
  });

  it("applies the saturday loading on a Saturday shift", async () => {
    const b = await calculateShiftPay(shift({ startedAt: "2026-08-15T09:00:00", endedAt: "2026-08-15T17:00:00" }), rate());
    expect(b.appliedLoadings.map((l) => l.type).sort()).toEqual(["casual", "saturday"]);
    expect(b.totalPay).toBe(360); // 240 + 25% (casual) + 25% (saturday)
  });

  it("applies the sunday loading on a Sunday shift", async () => {
    const b = await calculateShiftPay(shift({ startedAt: "2026-08-16T09:00:00", endedAt: "2026-08-16T17:00:00" }), rate());
    expect(b.appliedLoadings.map((l) => l.type).sort()).toEqual(["casual", "sunday"]);
    expect(b.totalPay).toBe(420); // 240 + 25% + 50%
  });

  it("applies the public holiday loading when the holiday lookup says so, regardless of day of week", async () => {
    isPublicHolidayMock.mockResolvedValue(true);
    // 2026-08-10 is itself a Monday, so this also proves public_holiday and weekday aren't exclusive.
    const b = await calculateShiftPay(shift(), rate());
    expect(b.appliedLoadings.map((l) => l.type).sort()).toEqual(["casual", "public_holiday"]);
    expect(b.totalPay).toBe(660); // 240 + 25% + 150%
  });

  it("does not apply the casual loading for permanent employees, even if the row exists", async () => {
    const b = await calculateShiftPay(shift(), rate({ employmentType: "permanent" }));
    expect(b.appliedLoadings).toEqual([]);
    expect(b.totalPay).toBe(240);
  });

  it("does not apply a loading type that has no matching row on the rate template", async () => {
    // Saturday shift, but the rate template only defines a casual loading.
    const b = await calculateShiftPay(
      shift({ startedAt: "2026-08-15T09:00:00", endedAt: "2026-08-15T17:00:00" }),
      rate({ loading: [{ type: "casual", percentage: 25 }] })
    );
    expect(b.appliedLoadings.map((l) => l.type)).toEqual(["casual"]);
  });
});

describe("calculatePay", () => {
  it("throws when a shift references a rate template that doesn't exist", async () => {
    await expect(calculatePay([shift({ rate: "missing" })], [rate()])).rejects.toThrow(
      /No RateTemplate found for shift s1/
    );
  });

  it("groups same-fortnight, same-employer shifts into a single pay period and taxes the combined gross once", async () => {
    // Aug 10, 11, 13 and 18 are all within the same fortnight relative to the "2026-08-12"
    // payCycleAnchor used by the rate() helper (confirmed via isoFortnightStart directly).
    const shifts = ["10", "11", "13", "18"].map((day) =>
      shift({ id: `s-${day}`, startedAt: `2026-08-${day}T09:00:00`, endedAt: `2026-08-${day}T17:00:00` })
    );
    const result = await calculatePay(shifts, [rate()]);

    expect(result.payPeriods).toHaveLength(1);
    const [period] = result.payPeriods;
    expect(period.periodStart).toBe("2026-08-10");
    expect(period.employer).toBe("Woolworths");
    expect(period.grossPay).toBe(1200); // 4 x 300
    expect(period.shiftIds).toEqual(["s-10", "s-11", "s-13", "s-18"]);
    // Tax is computed once on the $1200 fortnightly total, not summed from four per-shift taxations.
    expect(period.taxWithheld).toBeGreaterThan(0);
    expect(period.netPay).toBe(period.grossPay - period.taxWithheld);
  });

  it("keeps two employers in the same fortnight as separate pay periods", async () => {
    const rateA = rate({ id: "rate-a", employer: "Woolworths" });
    const rateB = rate({ id: "rate-b", employer: "Coles" });
    const shifts = [
      shift({ id: "s1", rate: "rate-a" }),
      shift({ id: "s2", rate: "rate-b", startedAt: "2026-08-11T09:00:00", endedAt: "2026-08-11T17:00:00" }),
    ];

    const result = await calculatePay(shifts, [rateA, rateB]);

    expect(result.payPeriods).toHaveLength(2);
    expect(result.payPeriods.map((p) => p.employer).sort()).toEqual(["Coles", "Woolworths"]);
  });

  it("splits shifts in different fortnights into separate pay periods", async () => {
    const shifts = [
      shift({ id: "s1", startedAt: "2026-08-10T09:00:00", endedAt: "2026-08-10T17:00:00" }), // fortnight of Aug 10
      shift({ id: "s2", startedAt: "2026-08-25T09:00:00", endedAt: "2026-08-25T17:00:00" }), // fortnight of Aug 24
    ];

    const result = await calculatePay(shifts, [rate()]);

    expect(result.payPeriods.map((p) => p.periodStart)).toEqual(["2026-08-10", "2026-08-24"]);
  });

  it("uses ISO-week grouping and weeklyPaygWithholding when payFrequency is weekly", async () => {
    // Same three shifts/gross ($900) as the fortnightly grouping test above, but weekly —
    // proves the weekly formula is actually used (weekly(900)=106, fortnightly(900)=26, so a
    // wrong branch here wouldn't just be off by rounding, it'd be a clearly different number).
    const shifts = ["10", "11", "13"].map((day) =>
      shift({ id: `s-${day}`, startedAt: `2026-08-${day}T09:00:00`, endedAt: `2026-08-${day}T17:00:00` })
    );
    const result = await calculatePay(shifts, [rate({ payFrequency: "weekly", payCycleAnchor: undefined })]);

    expect(result.payPeriods).toHaveLength(1);
    const [period] = result.payPeriods;
    expect(period.periodStart).toBe("2026-08-10"); // Monday of that ISO week
    expect(period.grossPay).toBe(900);
    expect(period.taxWithheld).toBe(106);
    expect(period.netPay).toBe(900 - 106);
  });

  it("keeps weekly and fortnightly periods separate for the same employer, even when their computed period start coincides", async () => {
    // isoWeekStart("2026-08-10") and isoFortnightStart("2026-08-10", "2026-08-12") are both
    // "2026-08-10" (confirmed directly) — without payFrequency in the grouping key, these two
    // rate templates for the same employer would wrongly merge into one period.
    const weeklyRate = rate({ id: "rate-weekly", payFrequency: "weekly", payCycleAnchor: undefined });
    const fortnightlyRate = rate({ id: "rate-fortnightly", payFrequency: "fortnightly" });
    const shifts = [
      shift({ id: "s1", rate: "rate-weekly" }),
      shift({ id: "s2", rate: "rate-fortnightly" }),
    ];

    const result = await calculatePay(shifts, [weeklyRate, fortnightlyRate]);

    expect(result.payPeriods).toHaveLength(2);
    expect(result.payPeriods.every((p) => p.periodStart === "2026-08-10")).toBe(true);
    expect(result.payPeriods.map((p) => p.payFrequency).sort()).toEqual(["fortnightly", "weekly"]);
  });

  it("totals equal the sum of per-period figures", async () => {
    const shifts = [
      shift({ id: "s1", startedAt: "2026-08-10T09:00:00", endedAt: "2026-08-10T17:00:00" }), // fortnight of Aug 10
      shift({ id: "s2", startedAt: "2026-08-25T09:00:00", endedAt: "2026-08-25T17:00:00" }), // fortnight of Aug 24
    ];

    const result = await calculatePay(shifts, [rate()]);

    expect(result.payPeriods).toHaveLength(2); // confirms this is actually summing across periods
    const sumGross = result.payPeriods.reduce((sum, p) => sum + p.grossPay, 0);
    const sumTax = result.payPeriods.reduce((sum, p) => sum + p.taxWithheld, 0);
    expect(result.totalGrossPay).toBe(sumGross);
    expect(result.totalTaxWithheld).toBe(sumTax);
    expect(result.totalNetPay).toBe(result.totalGrossPay - result.totalTaxWithheld);
  });
});
