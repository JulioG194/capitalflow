import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

describe("MarketingFooter", () => {
  it("links to /terms and /privacy and shows the disclaimer + copyright (AC6, AC7)", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Términos de servicio" }),
    ).toHaveAttribute("href", "/terms");
    expect(
      screen.getByRole("link", { name: "Privacidad" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByText(
        "Simulador de inversiones con fines educativos. No se manejan fondos reales.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/CapitalFlow\. Todos los derechos reservados\./)).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { container } = render(<MarketingFooter />);
    expect(container).toMatchSnapshot();
  });
});
