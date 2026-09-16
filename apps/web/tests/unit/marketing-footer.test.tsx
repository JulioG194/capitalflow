import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

describe("MarketingFooter", () => {
  it("links to /terms and /privacy and shows the disclaimer + copyright (AC6, AC7)", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "/terms");
    expect(
      screen.getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByText(
        "Educational investment simulator. No real funds are involved.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/CapitalFlow\. All rights reserved\./)).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { container } = render(<MarketingFooter />);
    expect(container).toMatchSnapshot();
  });
});
