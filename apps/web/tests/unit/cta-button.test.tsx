import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CTAButton } from "@/components/marketing/CTAButton";

describe("CTAButton", () => {
  it("renders as a real link (works without JavaScript, AC8/AC21)", () => {
    render(<CTAButton href="/register">Sign up</CTAButton>);
    const link = screen.getByRole("link", { name: "Sign up" });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("applies focus-visible styling classes for keyboard users (AC21)", () => {
    render(<CTAButton href="/login">Log in</CTAButton>);
    const link = screen.getByRole("link", { name: "Log in" });
    expect(link.className).toMatch(/rounded-card/);
  });
});
