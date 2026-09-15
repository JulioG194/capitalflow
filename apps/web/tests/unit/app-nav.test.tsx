import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppNav } from "@/components/app/AppNav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

describe("AppNav", () => {
  it("shows the Modo Simulador badge and a logout control on every authenticated page", () => {
    render(<AppNav />);

    expect(screen.getByRole("note")).toHaveTextContent(/simulador/i);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CapitalFlow" })).toHaveAttribute(
      "href",
      "/app/profile",
    );
  });
});
