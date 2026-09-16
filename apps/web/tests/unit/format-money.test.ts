import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format-money";

describe("formatMoney", () => {
  it("formats a numeric string as USD currency", () => {
    expect(formatMoney("137.25")).toBe("$137.25");
  });

  it("formats large values (e.g. BTC/USD) with thousands separators", () => {
    expect(formatMoney("64321.5")).toBe("$64,321.50");
  });

  it("formats negative values", () => {
    expect(formatMoney("-12.3")).toBe("-$12.30");
  });

  it("returns the original string unchanged if it isn't numeric", () => {
    expect(formatMoney("not-a-number")).toBe("not-a-number");
  });
});
