import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingNav } from "@/components/marketing/MarketingNav";

describe("MarketingNav", () => {
  it("renders the required nav structure (AC24): logo, links, auth CTAs", () => {
    render(<MarketingNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /CapitalFlow/i })[0]).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link", { name: "How it works" })[0]).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getAllByRole("link", { name: "Pricing" })[0]).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getAllByRole("link", { name: "About" })[0]).toHaveAttribute(
      "href",
      "/about",
    );
    expect(
      screen.getAllByRole("link", { name: "Log in" })[0],
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getAllByRole("link", { name: "Sign up" })[0],
    ).toHaveAttribute("href", "/register");
  });

  it("matches snapshot", () => {
    const { container } = render(<MarketingNav />);
    expect(container).toMatchSnapshot();
  });
});
