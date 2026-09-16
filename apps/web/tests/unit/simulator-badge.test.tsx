import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";
import { DISCLAIMER_TEXT } from "@/lib/site-config";

describe("SimulatorBadge", () => {
  it("renders the exact simulator disclaimer copy (AC5)", () => {
    render(<SimulatorBadge />);
    expect(
      screen.getByText(
        "Educational investment simulator. No real funds are involved.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
});
