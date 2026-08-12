export interface PublicHoliday {
  date: string; // "YYYY-MM-DD"
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null; // e.g. ["AU-QLD"], null when `global` is true
}

const yearCache = new Map<string, Promise<PublicHoliday[]>>();

/** Fetches all public holidays for a country/year, cached in memory for the process lifetime. */
export function getPublicHolidays(countryCode: string, year: number): Promise<PublicHoliday[]> {
  const key = `${countryCode}-${year}`;
  const cached = yearCache.get(key);
  if (cached) return cached;

  const promise = fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, {
    // Holidays for a given year are fixed well in advance; a long revalidate window avoids refetching.
    next: { revalidate: 60 * 60 * 24 * 30 },
  }).then((res) => {
    if (!res.ok) throw new Error(`Nager.Date request failed: ${res.status}`);
    return res.json() as Promise<PublicHoliday[]>;
  });

  yearCache.set(key, promise);
  return promise;
}

/** region is e.g. "AU-QLD"; date is "YYYY-MM-DD". */
export async function isPublicHoliday(region: string, date: string): Promise<boolean> {
  const countryCode = region.split("-")[0];
  const year = Number(date.slice(0, 4));
  const holidays = await getPublicHolidays(countryCode, year);
  return holidays.some((h) => h.date === date && (h.global || h.counties?.includes(region)));
}
