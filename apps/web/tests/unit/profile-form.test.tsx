import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { UserDto } from "@capitalflow/shared-types";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { updateMe } from "@/lib/auth/auth-client";

const refreshUserMock = vi.fn();
let authState: { user: UserDto | null; isLoading: boolean };

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ...authState, refreshUser: refreshUserMock }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  updateMe: vi.fn(),
}));

const user: UserDto = {
  id: "1",
  email: "ada@example.com",
  name: "Ada",
  createdAt: new Date().toISOString(),
};

describe("ProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user, isLoading: false };
  });

  it("AC40: shows the current email and pre-fills the name field", () => {
    render(<ProfileForm />);

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ada");
  });

  it("shows a loading state while the session is still being restored", () => {
    authState = { user: null, isLoading: true };
    render(<ProfileForm />);

    expect(screen.getByText("Cargando perfil...")).toBeInTheDocument();
  });

  it("AC37: blocks submission when the name is cleared", async () => {
    render(<ProfileForm />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(updateMe).not.toHaveBeenCalled();
    });
  });

  it("AC28/AC40: submits the updated name and refreshes the user", async () => {
    vi.mocked(updateMe).mockResolvedValue({ ...user, name: "Ada Lovelace" });
    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({ name: "Ada Lovelace" });
    });
    await waitFor(() => {
      expect(refreshUserMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Perfil actualizado.")).toBeInTheDocument();
  });
});
