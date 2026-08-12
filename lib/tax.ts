interface WeeklyWithholdingBracket {
  lessThan: number | null; // null = top bracket ("$X & over")
  nil?: true;
  a?: number;
  b?: number;
}

/**
 * ATO Schedule 1 (NAT 1004), Scale 2 — Australian resident, tax-free threshold claimed,
 * no HELP/STSL debt. Published 17 June 2026, applies to payments made from 1 July 2026.
 * Source: https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/coefficients-to-use-in-formulas-for-withholding-from-weekly-payments
 * Cross-checked against the ATO's own weekly sample data: $538 -> $27, $721 -> $68, $865 -> $94.
 *
 * This assumption (Scale 2, no HELP/STSL) is fixed for the whole calculator — it doesn't vary
 * per RateTemplate. Revisit if a scenario needing a different scale comes up.
 */
const SCALE_2_WEEKLY_BRACKETS: WeeklyWithholdingBracket[] = [
  { lessThan: 362, nil: true },
  { lessThan: 538, a: 0.15, b: 54.3462 },
  { lessThan: 673, a: 0.25, b: 108.2135 },
  { lessThan: 721, a: 0.17, b: 54.3473 },
  { lessThan: 865, a: 0.179, b: 60.8377 },
  { lessThan: 1282, a: 0.3227, b: 185.1935 },
  { lessThan: 2596, a: 0.32, b: 181.7319 },
  { lessThan: 3653, a: 0.39, b: 363.4627 },
  { lessThan: null, a: 0.47, b: 655.7704 },
];

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

/**
 * PAYG withholding for one week's gross earnings, per ATO Schedule 1 Scale 2.
 * grossWeekly is the total gross pay for the week (dollars, before tax).
 */
export function weeklyPaygWithholding(grossWeekly: number): number {
  if (grossWeekly <= 0) return 0;

  // Per ATO: weekly earnings (x) = whole dollars of earnings (cents ignored) + 99 cents.
  const x = Math.floor(grossWeekly) + 0.99;

  const bracket = SCALE_2_WEEKLY_BRACKETS.find((b) => b.lessThan === null || x < b.lessThan)!;
  if (bracket.nil) return 0;

  return roundHalfUp(bracket.a! * x - bracket.b!);
}

/**
 * PAYG withholding for one fortnight's gross earnings. The ATO doesn't publish separate
 * fortnightly bracket coefficients — per Schedule 1, fortnightly withholding is worked out by
 * converting to a weekly-equivalent amount (divide by 2), applying the weekly formula, then
 * doubling the result.
 */
export function fortnightlyPaygWithholding(grossFortnightly: number): number {
  return weeklyPaygWithholding(grossFortnightly / 2) * 2;
}
