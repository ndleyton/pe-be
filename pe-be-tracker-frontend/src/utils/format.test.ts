import { describe, expect, it } from "vitest";

import { formatDecimal, parseDecimalInput } from "./format";

describe("formatDecimal", () => {
  it("formats integers without decimals", () => {
    expect(formatDecimal(100)).toBe("100");
    expect(formatDecimal("225")).toBe("225");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatDecimal(83.91459)).toBe("83.91");
    expect(formatDecimal(83.915)).toBe("83.92");
    expect(formatDecimal("83.915")).toBe("83.92");
  });

  it("strips unnecessary trailing zeros", () => {
    expect(formatDecimal(100.0)).toBe("100");
    expect(formatDecimal(100.5)).toBe("100.5");
    expect(formatDecimal(100.50)).toBe("100.5");
  });

  it("returns '-' for invalid inputs", () => {
    expect(formatDecimal(null)).toBe("-");
    expect(formatDecimal(undefined)).toBe("-");
    expect(formatDecimal("")).toBe("-");
    expect(formatDecimal("abc")).toBe("-");
  });

  it("returns '-' for the number zero", () => {
    expect(formatDecimal(0)).toBe("-");
    expect(formatDecimal("0")).toBe("-");
  });
});

describe("parseDecimalInput", () => {
  it("parses valid decimals", () => {
    expect(parseDecimalInput("100.5")).toBe(100.5);
    expect(parseDecimalInput(" 100.5 ")).toBe(100.5);
  });

  it("handles comma as decimal separator", () => {
    expect(parseDecimalInput("100,5")).toBe(100.5);
  });

  it("returns null for empty or partial inputs", () => {
    expect(parseDecimalInput("")).toBe(null);
    expect(parseDecimalInput(".")).toBe(null);
    expect(parseDecimalInput("-")).toBe(null);
    expect(parseDecimalInput(" , ")).toBe(null);
  });

  it("returns null for non-numeric input", () => {
    expect(parseDecimalInput("abc")).toBe(null);
  });
});
