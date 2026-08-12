# Pay Calculator

A pay calculator for shift workers. Set up a rate template for each job, log your shifts
against it, and get gross pay (with day-of-week and public-holiday loadings) and PAYG tax
withholding — before-tax and after-tax, per weekly pay period.

Live: https://paycalculator-omega.vercel.app

## How it works

1. **Rate templates** — one per job/pay rate: employer, base hourly rate, region, casual vs.
   permanent, and a loading row for each pay category that applies (casual, Saturday, Sunday,
   public holiday).
2. **Shifts** — log start/end times against a rate template.
3. **Calculate** — for each shift, the calculator works out which loadings apply based on the
   shift's actual date (day of week, and whether it's a public holiday in that region), sums
   gross pay, groups shifts into weekly pay periods per employer, and applies PAYG withholding
   to each period's total.

Public holidays are looked up live via the free [Nager.Date](https://date.nager.at) API and
cached per country/year. Tax withholding follows the ATO's own published formulas (Schedule 1,
NAT 1004, Scale 2 — Australian resident, tax-free threshold claimed, no HELP/STSL debt).

Data is stored in the browser's `localStorage` — nothing is sent to a server except the pay
calculation itself (rate templates and shifts, sent to `/api/calculate` and back).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test          # run once
npm run test:watch
```

Vitest, covering `lib/*.ts` — the calculation engine, tax withholding, date handling, and
public holiday lookup.

## Project structure

```
lib/
  types.ts           RateTemplate / ShiftEntry schema
  calculate-pay.ts    pay + weekly PAYG withholding calculation
  tax.ts              ATO Schedule 1 Scale 2 withholding formula
  holidays.ts          Nager.Date public holiday lookup + cache
  date-utils.ts        timezone-safe date helpers
  storage.ts            localStorage persistence
app/
  page.tsx              UI
  api/calculate/route.ts  calculation API route
```

See `PROGRESS.md` for a running log of what's built, what's deliberately deferred, and the
assumptions baked into the current implementation.

## Deploying

```bash
vercel          # preview
vercel --prod   # production
```
