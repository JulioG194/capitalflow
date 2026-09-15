import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LogoutButton } from "@/components/app/LogoutButton";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const logoutMock = vi.fn();
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC42: calls logout() and navigates to /login", async () => {
    logoutMock.mockResolvedValue(undefined);
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });

  it("still navigates to /login even when logout() rejects (network failure)", async () => {
    logoutMock.mockRejectedValue(new Error("network error"));
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });
});
