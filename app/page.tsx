"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RateTemplate, ShiftEntry, Loading } from "@/lib/types";
import { loadRateTemplates, saveRateTemplates, loadShifts, saveShifts } from "@/lib/storage";
import type { PayResult, PayPeriod } from "@/lib/calculate-pay";

const emptyLoading: Loading = { type: "casual", percentage: 25 };

// Nager.Date subdivision codes for Australian states/territories — matches the `region` field
// used for public holiday lookups in lib/holidays.ts.
const AU_REGIONS = [
  { value: "AU-QLD", label: "Queensland" },
  { value: "AU-NSW", label: "New South Wales" },
  { value: "AU-VIC", label: "Victoria" },
  { value: "AU-WA", label: "Western Australia" },
  { value: "AU-SA", label: "South Australia" },
  { value: "AU-TAS", label: "Tasmania" },
  { value: "AU-ACT", label: "Australian Capital Territory" },
  { value: "AU-NT", label: "Northern Territory" },
];

// The only loading types the calculation engine actually detects (lib/calculate-pay.ts) —
// a free-text field here would let a typo (e.g. "Saturday" vs "saturday") silently fail to match.
const LOADING_TYPES = [
  { value: "casual", label: "Casual loading" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
  { value: "public_holiday", label: "Public holiday" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function StepHeading({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-3xl text-stamp leading-none">{step}</span>
      <div>
        <h2 className="font-display uppercase tracking-wide text-lg text-ink">{title}</h2>
        <p className="text-sm text-ink-soft">{description}</p>
      </div>
    </div>
  );
}

function newRateTemplateDraft(): Omit<RateTemplate, "id"> {
  return {
    employer: "",
    baseRate: 0,
    employmentType: "casual",
    region: "AU-QLD",
    loading: [{ ...emptyLoading }],
  };
}

function newShiftDraft(rateId: string): Omit<ShiftEntry, "id"> {
  return { startedAt: "", endedAt: "", rate: rateId };
}

function PayslipStub({
  title,
  subtitle,
  grossPay,
  taxWithheld,
  netPay,
}: {
  title: string;
  subtitle: string;
  grossPay: number;
  taxWithheld: number;
  netPay: number;
}) {
  return (
    <div className="border-t-2 border-dashed border-rule pt-4 flex flex-col gap-2 font-mono">
      <div>
        <p className="eyebrow">Payslip stub</p>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-soft">{title}</span>
        <span>${grossPay.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-soft">Tax withheld</span>
        <span className="text-deduction">-${taxWithheld.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-baseline border-t border-rule pt-2">
        <span className="font-display uppercase tracking-wide text-ink-soft text-sm">Net pay</span>
        <span className="text-net text-2xl font-semibold">${netPay.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [rateTemplates, setRateTemplates] = useState<RateTemplate[]>([]);
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [rateDraft, setRateDraft] = useState(newRateTemplateDraft());
  const [shiftDraft, setShiftDraft] = useState(newShiftDraft(""));
  const [result, setResult] = useState<PayResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage is unavailable during SSR, so initial state can only be hydrated
    // client-side here — the canonical exception to this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRateTemplates(loadRateTemplates());
    setShifts(loadShifts());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveRateTemplates(rateTemplates);
  }, [rateTemplates, loaded]);

  useEffect(() => {
    if (loaded) saveShifts(shifts);
  }, [shifts, loaded]);

  function addRateTemplate() {
    if (!rateDraft.employer || rateDraft.baseRate <= 0) return;
    const rate: RateTemplate = { ...rateDraft, id: crypto.randomUUID() };
    setRateTemplates((prev) => [...prev, rate]);
    setRateDraft(newRateTemplateDraft());
  }

  function removeRateTemplate(id: string) {
    setRateTemplates((prev) => prev.filter((r) => r.id !== id));
    setShifts((prev) => prev.filter((s) => s.rate !== id));
  }

  function addShift() {
    if (!shiftDraft.startedAt || !shiftDraft.endedAt || !shiftDraft.rate) return;
    const shift: ShiftEntry = { ...shiftDraft, id: crypto.randomUUID() };
    setShifts((prev) => [...prev, shift]);
    setShiftDraft(newShiftDraft(shiftDraft.rate));
  }

  function removeShift(id: string) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function updateLoadingRow(index: number, field: keyof Loading, value: string) {
    setRateDraft((prev) => ({
      ...prev,
      loading: prev.loading.map((l, i) =>
        i === index ? { ...l, [field]: field === "percentage" ? Number(value) : value } : l
      ),
    }));
  }

  function addLoadingRow() {
    setRateDraft((prev) => ({ ...prev, loading: [...prev.loading, { ...emptyLoading }] }));
  }

  function removeLoadingRow(index: number) {
    setRateDraft((prev) => ({ ...prev, loading: prev.loading.filter((_, i) => i !== index) }));
  }

  async function calculate() {
    setCalculating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts, rateTemplates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Calculation failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }

  const rateLabel = (id: string) => {
    const r = rateTemplates.find((rt) => rt.id === id);
    return r ? `${r.employer} — $${r.baseRate}/hr (${r.region})` : "Unknown rate";
  };

  const periodLabel = (p: PayPeriod) => `Week of ${p.weekStart} · ${p.employer}`;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-14">
        <div className="flex flex-col gap-2 border-b-2 border-ink pb-4">
          <h1 className="font-display uppercase tracking-wide text-3xl text-ink">Pay Calculator</h1>
          <p className="text-sm text-ink-soft">
            Set up a rate template for each job, log your shifts against it, then calculate your
            gross and take-home pay.
          </p>
        </div>

        {/* Rate Templates */}
        <section className="flex flex-col gap-4">
          <StepHeading
            step="01"
            title="Rate templates"
            description="One template per job/pay rate. Add a loading row for every category that applies — matched automatically against each shift's day of week and public holidays."
          />

          <div className="ledger-panel flex flex-col gap-5 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Employer">
                <input
                  className="input"
                  placeholder="e.g. Woolworths"
                  value={rateDraft.employer}
                  onChange={(e) => setRateDraft((p) => ({ ...p, employer: e.target.value }))}
                />
              </Field>
              <Field label="Base rate ($/hr)">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 27.81"
                  value={rateDraft.baseRate || ""}
                  onChange={(e) => setRateDraft((p) => ({ ...p, baseRate: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Region">
                <select
                  className="input"
                  value={rateDraft.region}
                  onChange={(e) => setRateDraft((p) => ({ ...p, region: e.target.value }))}
                >
                  {AU_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Employment type">
                <select
                  className="input"
                  value={rateDraft.employmentType}
                  onChange={(e) =>
                    setRateDraft((p) => ({ ...p, employmentType: e.target.value as RateTemplate["employmentType"] }))
                  }
                >
                  <option value="casual">Casual</option>
                  <option value="permanent">Permanent</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-ink-soft">Loadings</span>
              {rateDraft.loading.map((l, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <select
                    className="input flex-1"
                    value={l.type}
                    onChange={(e) => updateLoadingRow(i, "type", e.target.value)}
                  >
                    {LOADING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-24">
                    <input
                      className="input w-full pr-4"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={l.percentage || ""}
                      onChange={(e) => updateLoadingRow(i, "percentage", e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-0.5 bottom-1.5 text-sm text-ink-soft">%</span>
                  </div>
                  <button
                    className="font-display uppercase tracking-wide text-xs text-deduction hover:underline disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:no-underline"
                    onClick={() => removeLoadingRow(i)}
                    disabled={rateDraft.loading.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button className="btn-ghost w-fit" onClick={addLoadingRow}>
                + Add loading type
              </button>
            </div>

            <button
              className="btn-stamp w-fit"
              onClick={addRateTemplate}
              disabled={!rateDraft.employer || rateDraft.baseRate <= 0}
            >
              Add rate template
            </button>
          </div>

          {rateTemplates.length === 0 ? (
            <p className="text-sm text-ink-soft italic">
              No rate templates yet — add one above to start logging shifts.
            </p>
          ) : (
            <ul className="flex flex-col">
              {rateTemplates.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between items-center gap-3 border-b border-rule py-2.5 text-sm font-mono"
                >
                  <span className="min-w-0">
                    {r.employer} — ${r.baseRate}/hr — {r.employmentType} — {r.region} — loadings:{" "}
                    {r.loading.map((l) => `${l.type} +${l.percentage}%`).join(", ") || "none"}
                  </span>
                  <button
                    className="font-display uppercase tracking-wide text-xs text-deduction hover:underline shrink-0"
                    onClick={() => removeRateTemplate(r.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Shifts */}
        <section className="flex flex-col gap-4">
          <StepHeading step="02" title="Shifts" description="Log each shift you've worked." />

          {rateTemplates.length === 0 ? (
            <p className="text-sm text-ink-soft italic">Add a rate template above before logging shifts.</p>
          ) : (
            <div className="ledger-panel flex flex-wrap gap-4 items-end p-5">
              <Field label="Start">
                <input
                  className="input"
                  type="datetime-local"
                  value={shiftDraft.startedAt}
                  onChange={(e) => setShiftDraft((p) => ({ ...p, startedAt: e.target.value }))}
                />
              </Field>
              <Field label="End">
                <input
                  className="input"
                  type="datetime-local"
                  value={shiftDraft.endedAt}
                  onChange={(e) => setShiftDraft((p) => ({ ...p, endedAt: e.target.value }))}
                />
              </Field>
              <Field label="Rate template">
                <select
                  className="input"
                  value={shiftDraft.rate}
                  onChange={(e) => setShiftDraft((p) => ({ ...p, rate: e.target.value }))}
                >
                  <option value="">Select rate template</option>
                  {rateTemplates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.employer} — ${r.baseRate}/hr ({r.region})
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="btn-stamp"
                onClick={addShift}
                disabled={!shiftDraft.startedAt || !shiftDraft.endedAt || !shiftDraft.rate}
              >
                Add shift
              </button>
            </div>
          )}

          {shifts.length === 0 ? (
            <p className="text-sm text-ink-soft italic">No shifts logged yet.</p>
          ) : (
            <ul className="flex flex-col">
              {shifts.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between items-center gap-3 border-b border-rule py-2.5 text-sm font-mono"
                >
                  <span className="min-w-0">
                    {s.startedAt.replace("T", " ")} → {s.endedAt.replace("T", " ")} · {rateLabel(s.rate)}
                  </span>
                  <button
                    className="font-display uppercase tracking-wide text-xs text-deduction hover:underline shrink-0"
                    onClick={() => removeShift(s.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Results */}
        <section className="flex flex-col gap-4">
          <StepHeading step="03" title="Calculate" description="Gross pay, PAYG withholding, and net pay." />

          <div>
            <button
              className="btn-stamp"
              onClick={calculate}
              disabled={calculating || shifts.length === 0}
            >
              {calculating ? "Calculating…" : "Calculate pay"}
            </button>
            {shifts.length === 0 && <p className="text-sm text-ink-soft italic mt-2">Log at least one shift first.</p>}
          </div>

          {error && <p className="text-deduction text-sm">{error}</p>}

          {result && (
            <div className="flex flex-col gap-8">
              <div>
                <p className="eyebrow mb-2">Shifts (before tax)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse font-mono">
                    <thead>
                      <tr className="text-left border-b border-ink">
                        <th className="py-2 font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Hours
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Base pay
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Loadings
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Gross
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.breakdowns.map((b) => (
                        <tr key={b.shiftId} className="border-b border-rule">
                          <td className="py-2">{b.hours}</td>
                          <td>${b.basePay.toFixed(2)}</td>
                          <td className="text-ink-soft whitespace-nowrap">
                            {b.appliedLoadings.length
                              ? b.appliedLoadings.map((l) => `${l.type} (+$${l.amount.toFixed(2)})`).join(", ")
                              : "none"}
                          </td>
                          <td className="font-semibold">${b.totalPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="eyebrow mb-1">Pay periods</p>
                <p className="text-xs text-ink-soft mb-2">
                  Weekly, per employer. PAYG withholding assumes an Australian resident claiming the tax-free
                  threshold, with no HELP/STSL debt.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse font-mono">
                    <thead>
                      <tr className="text-left border-b border-ink">
                        <th className="py-2 font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Week starting
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Employer
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Gross
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">
                          Tax withheld
                        </th>
                        <th className="font-body text-xs uppercase tracking-wide text-ink-soft font-normal">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.payPeriods.map((p) => (
                        <tr key={`${p.weekStart}|${p.employer}`} className="border-b border-rule">
                          <td className="py-2 whitespace-nowrap">{p.weekStart}</td>
                          <td className="font-body whitespace-nowrap">{p.employer}</td>
                          <td className="whitespace-nowrap">${p.grossPay.toFixed(2)}</td>
                          <td className="text-deduction whitespace-nowrap">-${p.taxWithheld.toFixed(2)}</td>
                          <td className="font-semibold text-net whitespace-nowrap">${p.netPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {result.payPeriods.map((p) => (
                  <PayslipStub
                    key={`${p.weekStart}|${p.employer}`}
                    title={periodLabel(p)}
                    subtitle="Weekly PAYG withholding, Scale 2"
                    grossPay={p.grossPay}
                    taxWithheld={p.taxWithheld}
                    netPay={p.netPay}
                  />
                ))}
                {result.payPeriods.length > 1 && (
                  <PayslipStub
                    title="Total across all periods"
                    subtitle="Combined"
                    grossPay={result.totalGrossPay}
                    taxWithheld={result.totalTaxWithheld}
                    netPay={result.totalNetPay}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
