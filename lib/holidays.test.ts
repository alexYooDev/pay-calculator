import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicHolidays, isPublicHoliday, type PublicHoliday } from "./holidays";

function mockFetchOnce(holidays: PublicHoliday[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(holidays),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Each test uses its own fake country code so the module-level year cache in holidays.ts
// (shared across tests in this file) never collides between cases.
let countryCounter = 0;
function fakeCountryCode() {
  countryCounter += 1;
  return `Z${countryCounter}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isPublicHoliday", () => {
  it("matches a global holiday regardless of region", async () => {
    const country = fakeCountryCode();
    mockFetchOnce([
      { date: "2026-01-01", localName: "New Year's Day", name: "New Year's Day", global: true, counties: null },
    ]);
    expect(await isPublicHoliday(`${country}-QLD`, "2026-01-01")).toBe(true);
    expect(await isPublicHoliday(`${country}-NSW`, "2026-01-01")).toBe(true);
  });

  it("matches a region-specific holiday only in its listed region", async () => {
    const country = fakeCountryCode();
    mockFetchOnce([
      { date: "2026-05-04", localName: "Labour Day", name: "Labour Day", global: false, counties: [`${country}-QLD`] },
    ]);
    expect(await isPublicHoliday(`${country}-QLD`, "2026-05-04")).toBe(true);
    expect(await isPublicHoliday(`${country}-NSW`, "2026-05-04")).toBe(false);
  });

  it("returns false when no holiday matches the date", async () => {
    const country = fakeCountryCode();
    mockFetchOnce([
      { date: "2026-01-01", localName: "New Year's Day", name: "New Year's Day", global: true, counties: null },
    ]);
    expect(await isPublicHoliday(`${country}-QLD`, "2026-03-15")).toBe(false);
  });
});

describe("getPublicHolidays", () => {
  it("caches per country/year — a repeated lookup doesn't refetch", async () => {
    const country = fakeCountryCode();
    const fetchMock = mockFetchOnce([]);

    await getPublicHolidays(country, 2026);
    await getPublicHolidays(country, 2026);
    await isPublicHoliday(`${country}-QLD`, "2026-01-01");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates an error when the request fails", async () => {
    const country = fakeCountryCode();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPublicHolidays(country, 2026)).rejects.toThrow("Nager.Date request failed: 500");
  });
});
