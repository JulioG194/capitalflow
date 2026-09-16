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
  it("shows the Simulator mode badge and a logout control on every authenticated page", () => {
    render(<AppNav />);

    expect(screen.getByRole("note")).toHaveTextContent(/simulator/i);
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CapitalFlow" })).toHaveAttribute(
      "href",
      "/app/portfolio",
    );
  });

  it("links to Market, My portfolio, Invest, and Profile", () => {
    render(<AppNav />);

    expect(screen.getAllByRole("link", { name: "Market" })[0]).toHaveAttribute(
      "href",
      "/app/market",
    );
    expect(screen.getAllByRole("link", { name: "My portfolio" })[0]).toHaveAttribute(
      "href",
      "/app/portfolio",
    );
    expect(screen.getAllByRole("link", { name: "Invest" })[0]).toHaveAttribute(
      "href",
      "/app/invest",
    );
    expect(screen.getAllByRole("link", { name: "Profile" })[0]).toHaveAttribute(
      "href",
      "/app/profile",
    );
  });
});
