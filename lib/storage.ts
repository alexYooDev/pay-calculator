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

export const loadRateTemplates = () => load<RateTemplate>(RATE_TEMPLATES_KEY);
export const saveRateTemplates = (v: RateTemplate[]) => save(RATE_TEMPLATES_KEY, v);
export const loadShifts = () => load<ShiftEntry>(SHIFTS_KEY);
export const saveShifts = (v: ShiftEntry[]) => save(SHIFTS_KEY, v);
