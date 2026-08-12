import { describe, expect, it } from "vitest";
import { weeklyPaygWithholding } from "./tax";

describe("weeklyPaygWithholding", () => {
  it("matches the ATO's own published Scale 2 weekly sample data", () => {
    // Cross-checked by hand against ato.gov.au's sample-data page for the 2026-27 schedule
    // before these coefficients were used anywhere in the app.
    expect(weeklyPaygWithholding(538)).toBe(27);
    expect(weeklyPaygWithholding(721)).toBe(68);
    expect(weeklyPaygWithholding(865)).toBe(94);
  });

  it("withholds nothing at or below the tax-free threshold", () => {
    expect(weeklyPaygWithholding(0)).toBe(0);
    expect(weeklyPaygWithholding(-100)).toBe(0);
    expect(weeklyPaygWithholding(361)).toBe(0);
  });

  it("crosses the tax-free threshold boundary correctly", () => {
    // $362 leaves the nil bracket, but the formula still rounds to $0 here.
    expect(weeklyPaygWithholding(362)).toBe(0);
    expect(weeklyPaygWithholding(537)).toBe(26);
  });

  it("straddles interior bracket boundaries", () => {
    expect(weeklyPaygWithholding(1281)).toBe(229);
    expect(weeklyPaygWithholding(1282)).toBe(229);
  });

  it("straddles the top bracket ($3,653 & over)", () => {
    expect(weeklyPaygWithholding(3652)).toBe(1061);
    expect(weeklyPaygWithholding(3653)).toBe(1062);
    expect(weeklyPaygWithholding(4000)).toBe(1225);
  });
});
