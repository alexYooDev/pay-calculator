function parseDateParts(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  return [year, month, day];
}

/**
 * Day of week (0 = Sunday .. 6 = Saturday) for a "YYYY-MM-DD" date.
 * Computed from the date's own components (not `new Date(str).getDay()`), so the result
 * doesn't depend on the server's local timezone — that would misclassify dates near midnight
 * once deployed somewhere other than the shift's own region (e.g. Vercel runs in UTC).
 */
export function dayOfWeek(dateStr: string): number {
  const [year, month, day] = parseDateParts(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Adds `days` to a "YYYY-MM-DD" date, independent of server timezone. Returns "YYYY-MM-DD". */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = parseDateParts(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing this "YYYY-MM-DD" date. */
export function isoWeekStart(dateStr: string): string {
  const dow = dayOfWeek(dateStr); // 0 = Sunday
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offsetToMonday);
}

/** Whole days between two "YYYY-MM-DD" dates (b minus a). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parseDateParts(a);
  const [by, bm, bd] = parseDateParts(b);
  const msA = Date.UTC(ay, am - 1, ad);
  const msB = Date.UTC(by, bm - 1, bd);
  return (msB - msA) / (24 * 60 * 60 * 1000);
}

/**
 * Monday of the fortnight (14-day pay cycle) containing this "YYYY-MM-DD" date, relative to
 * `anchor` — the start of some known fortnight in the cycle (e.g. a RateTemplate's
 * payCycleAnchor). Unlike ISO weeks, fortnight boundaries aren't universal: two employers can
 * run fortnightly pay cycles offset by one week from each other, so an anchor is required.
 */
export function isoFortnightStart(dateStr: string, anchor: string): string {
  const anchorMonday = isoWeekStart(anchor);
  const dateMonday = isoWeekStart(dateStr);
  const weeksSinceAnchor = daysBetween(anchorMonday, dateMonday) / 7;

  const isSecondWeekOfFortnight = weeksSinceAnchor % 2 !== 0;
  return isSecondWeekOfFortnight ? addDays(dateMonday, -7) : dateMonday;
}