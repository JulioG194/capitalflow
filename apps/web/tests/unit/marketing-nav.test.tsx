import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingNav } from "@/components/marketing/MarketingNav";

describe("MarketingNav", () => {
  it("renders the required nav structure (AC24): logo, links, auth CTAs", () => {
    render(<MarketingNav />);

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /CapitalFlow/i })[0]).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link", { name: "Cómo funciona" })[0]).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getAllByRole("link", { name: "Precios" })[0]).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getAllByRole("link", { name: "Nosotros" })[0]).toHaveAttribute(
      "href",
      "/about",
    );
    expect(
      screen.getAllByRole("link", { name: "Iniciar sesión" })[0],
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getAllByRole("link", { name: "Registrarse" })[0],
    ).toHaveAttribute("href", "/register");
  });

  it("matches snapshot", () => {
    const { container } = render(<MarketingNav />);
    expect(container).toMatchSnapshot();
  });
});
