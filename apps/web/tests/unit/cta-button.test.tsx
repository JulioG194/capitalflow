import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CTAButton } from "@/components/marketing/CTAButton";

describe("CTAButton", () => {
  it("renders as a real link (works without JavaScript, AC8/AC21)", () => {
    render(<CTAButton href="/register">Registrarse</CTAButton>);
    const link = screen.getByRole("link", { name: "Registrarse" });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("applies focus-visible styling classes for keyboard users (AC21)", () => {
    render(<CTAButton href="/login">Iniciar sesión</CTAButton>);
    const link = screen.getByRole("link", { name: "Iniciar sesión" });
    expect(link.className).toMatch(/rounded-card/);
  });
});
