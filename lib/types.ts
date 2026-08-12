
export type EmploymentType = "casual" | "permanent";

export interface Loading {
  type: string; // e.g. "casual", "saturday", "sunday", "public_holiday", "evening"
  percentage: number; // e.g. 25 for +25%
}

export interface RateTemplate {
  id: string;
  employer: string;
  baseRate: number;
  employmentType: EmploymentType;
  loading: Loading[];
  region: string; // e.g. "AU-QLD"
}

export interface ShiftEntry {
  id: string;
  startedAt: string; // ISO datetime
  endedAt: string; // ISO datetime
  rate: string; // RateTemplate.id
}
