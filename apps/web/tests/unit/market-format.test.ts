import { describe, expect, it } from "vitest";
import {
  formatChangePercent,
  formatUpdatedAt,
  getChangeDirection,
} from "@/lib/market/format";

describe("formatChangePercent", () => {
  it("prefixes positive values with a plus sign", () => {
    expect(formatChangePercent("2.5")).toBe("+2.50%");
  });

  it("leaves negative values with their own minus sign", () => {
    expect(formatChangePercent("-1.2345")).toBe("-1.23%");
  });

  it("returns the original string unchanged if it isn't numeric", () => {
    expect(formatChangePercent("n/a")).toBe("n/a");
  });
});

describe("getChangeDirection", () => {
  it("classifies positive values as up", () => {
    expect(getChangeDirection("3.1")).toBe("up");
  });

  it("classifies negative values as down", () => {
    expect(getChangeDirection("-0.5")).toBe("down");
  });

  it("classifies zero and non-numeric values as flat", () => {
    expect(getChangeDirection("0")).toBe("flat");
    expect(getChangeDirection("n/a")).toBe("flat");
  });
});

describe("formatUpdatedAt", () => {
  it("formats an ISO timestamp as a locale time-of-day string", () => {
    expect(formatUpdatedAt("2026-09-15T10:30:05.000Z")).toMatch(
      /\d{2}:\d{2}:\d{2}/,
    );
  });

  it("returns a fallback for an invalid timestamp", () => {
    expect(formatUpdatedAt("not-a-date")).toBe("--");
  });
});
