import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketDelayDisclaimer } from "@/components/market/MarketDelayDisclaimer";

describe("MarketDelayDisclaimer", () => {
  it("states the data is delayed by 15 minutes and is for educational/simulated use (AC24)", () => {
    render(<MarketDelayDisclaimer />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("15");
    expect(note).toHaveTextContent(/minutes/);
    expect(note).toHaveTextContent(/educational/);
    expect(note).toHaveTextContent(/simulat/);
  });
});
