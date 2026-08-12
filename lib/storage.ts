import type { RateTemplate, ShiftEntry } from "./types";

const RATE_TEMPLATES_KEY = "pay-calculator:rate-templates";
const SHIFTS_KEY = "pay-calculator:shifts";

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

function save<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadRateTemplates(): RateTemplate[] {
  // Loaded as Partial, not RateTemplate — JSON.parse doesn't actually guarantee every field
  // is present, and data saved before payFrequency existed genuinely won't have it. "weekly"
  // matches what that older data actually meant (fortnightly support came later).
  return load<Partial<RateTemplate>>(RATE_TEMPLATES_KEY).map(
    (r) => ({ payFrequency: "weekly", ...r }) as RateTemplate
  );
}
export const saveRateTemplates = (v: RateTemplate[]) => save(RATE_TEMPLATES_KEY, v);
export const loadShifts = () => load<ShiftEntry>(SHIFTS_KEY);
export const saveShifts = (v: ShiftEntry[]) => save(SHIFTS_KEY, v);
