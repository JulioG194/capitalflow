import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";
import { DISCLAIMER_TEXT } from "@/lib/site-config";

describe("SimulatorBadge", () => {
  it("renders the exact simulator disclaimer copy (AC5)", () => {
    render(<SimulatorBadge />);
    expect(
      screen.getByText(
        "Simulador de inversiones con fines educativos. No se manejan fondos reales.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
});
