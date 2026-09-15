import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppNav } from "@/components/app/AppNav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/app/profile",
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
      "/app/portfolio",
    );
  });

  it("links to Mercado, Mi cartera, Invertir, and Perfil", () => {
    render(<AppNav />);

    expect(screen.getAllByRole("link", { name: "Mercado" })[0]).toHaveAttribute(
      "href",
      "/app/market",
    );
    expect(screen.getAllByRole("link", { name: "Mi cartera" })[0]).toHaveAttribute(
      "href",
      "/app/portfolio",
    );
    expect(screen.getAllByRole("link", { name: "Invertir" })[0]).toHaveAttribute(
      "href",
      "/app/invest",
    );
    expect(screen.getAllByRole("link", { name: "Perfil" })[0]).toHaveAttribute(
      "href",
      "/app/profile",
    );
  });
});
