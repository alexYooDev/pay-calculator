import { dayOfWeek, isoFortnightStart, isoWeekStart } from "./date-utils";
import { isPublicHoliday } from "./holidays";
import { fortnightlyPaygWithholding, weeklyPaygWithholding } from "./tax";
import type { RateTemplate, ShiftEntry } from "./types";

/** Canonical calendar-derived loading categories a shift can match against RateTemplate.loading[].type. */
export type CalendarLoadingType = "saturday" | "sunday" | "public_holiday";

export interface ShiftBreakdown {
  shiftId: string;
  hours: number;
  baseRate: number;
  basePay: number;
  appliedLoadings: { type: string; percentage: number; amount: number }[];
  totalPay: number;
}

function hoursBetween(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return ms / (1000 * 60 * 60);
}

/** Calendar categories that apply to a shift, based on its start date and region's public holidays. */
async function calendarLoadingTypes(shift: ShiftEntry, region: string): Promise<CalendarLoadingType[]> {
  const date = shift.startedAt.slice(0, 10); // "YYYY-MM-DD"
  const dow = dayOfWeek(date); // 0 = Sunday, 6 = Saturday

  const types: CalendarLoadingType[] = [];
  if (await isPublicHoliday(region, date)) types.push("public_holiday");
  if (dow === 6) types.push("saturday");
  if (dow === 0) types.push("sunday");
  return types;
}

/**
 * Computes pay for a single shift against its matching RateTemplate.
 * Loading percentages are read entirely from the RateTemplate (manual or future PDF-extracted) —
 * this function only decides which calendar categories apply and always applies a flat
 * "casual" loading type when present, regardless of date.
 */
export async function calculateShiftPay(shift: ShiftEntry, rate: RateTemplate): Promise<ShiftBreakdown> {
  const hours = hoursBetween(shift.startedAt, shift.endedAt);
  const basePay = hours * rate.baseRate;

  const applicableTypes = new Set<string>(await calendarLoadingTypes(shift, rate.region));
  if (rate.employmentType === "casual") applicableTypes.add("casual");

  const appliedLoadings = rate.loading
    .filter((l) => applicableTypes.has(l.type))
    .map((l) => ({
      type: l.type,
      percentage: l.percentage,
      amount: basePay * (l.percentage / 100),
    }));

  const totalPay = basePay + appliedLoadings.reduce((sum, l) => sum + l.amount, 0);

  return { shiftId: shift.id, hours, baseRate: rate.baseRate, basePay, appliedLoadings, totalPay };
}

export interface PayPeriod {
  periodStart: string; // "YYYY-MM-DD" (Monday) — start of the weekly or fortnightly pay cycle
  employer: string;
  payFrequency: RateTemplate["payFrequency"];
  grossPay: number;
  taxWithheld: number;
  netPay: number;
  shiftIds: string[];
}

export interface PayResult {
  breakdowns: ShiftBreakdown[];
  payPeriods: PayPeriod[];
  totalGrossPay: number;
  totalTaxWithheld: number;
  totalNetPay: number;
}

/**
 * PAYG withholding is calculated per pay period, not per shift, and each employer withholds
 * independently based only on what they pay — so periods are grouped by (period start,
 * employer, pay frequency). Frequency is part of the key, not just a detail read off the
 * period, so that a weekly and a fortnightly period for the same employer can never collide
 * even if their computed start dates happen to coincide.
 */
export async function calculatePay(shifts: ShiftEntry[], rateTemplates: RateTemplate[]): Promise<PayResult> {
  const ratesById = new Map(rateTemplates.map((r) => [r.id, r]));

  const breakdowns = await Promise.all(
    shifts.map((shift) => {
      const rate = ratesById.get(shift.rate);
      if (!rate) throw new Error(`No RateTemplate found for shift ${shift.id} (rate id: ${shift.rate})`);
      return calculateShiftPay(shift, rate);
    })
  );
  const breakdownsByShiftId = new Map(breakdowns.map((b) => [b.shiftId, b]));

  const periodsByKey = new Map<string, PayPeriod>();
  for (const shift of shifts) {
    const rate = ratesById.get(shift.rate)!;
    const breakdown = breakdownsByShiftId.get(shift.id)!;
    const date = shift.startedAt.slice(0, 10);
    const periodStart =
      rate.payFrequency === "fortnightly" ? isoFortnightStart(date, rate.payCycleAnchor!) : isoWeekStart(date);
    const key = `${periodStart}|${rate.employer}|${rate.payFrequency}`;

    const period = periodsByKey.get(key) ?? {
      periodStart,
      employer: rate.employer,
      payFrequency: rate.payFrequency,
      grossPay: 0,
      taxWithheld: 0,
      netPay: 0,
      shiftIds: [],
    };
    period.grossPay += breakdown.totalPay;
    period.shiftIds.push(shift.id);
    periodsByKey.set(key, period);
  }

  const payPeriods = Array.from(periodsByKey.values())
    .map((period) => {
      const taxWithheld =
        period.payFrequency === "fortnightly"
          ? fortnightlyPaygWithholding(period.grossPay)
          : weeklyPaygWithholding(period.grossPay);
      return { ...period, taxWithheld, netPay: period.grossPay - taxWithheld };
    })
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.employer.localeCompare(b.employer));

  const totalGrossPay = breakdowns.reduce((sum, b) => sum + b.totalPay, 0);
  const totalTaxWithheld = payPeriods.reduce((sum, p) => sum + p.taxWithheld, 0);
  const totalNetPay = totalGrossPay - totalTaxWithheld;

  return { breakdowns, payPeriods, totalGrossPay, totalTaxWithheld, totalNetPay };
}
