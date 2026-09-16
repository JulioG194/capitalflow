import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { registerRequest } from "@/lib/auth/auth-client";
import { ApiError } from "@/lib/auth/errors";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  registerRequest: vi.fn(),
}));

function fillForm({
  name = "Ada Lovelace",
  email = "ada@example.com",
  password = "correcthorse1",
}: { name?: string; email?: string; password?: string } = {}) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC37: blocks submission and shows field errors when the password is too weak", async () => {
    render(<RegisterForm />);
    fillForm({ password: "short" });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    // Zod messages from shared-types are shown as-is (English, spec 001).
    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 10 characters"),
      ).toBeInTheDocument();
    });
    expect(registerRequest).not.toHaveBeenCalled();
  });

  it("AC36/AC43: submits valid input to registerRequest and redirects on success", async () => {
    vi.mocked(registerRequest).mockResolvedValue({
      id: "1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      createdAt: new Date().toISOString(),
    });

    render(<RegisterForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerRequest).toHaveBeenCalledWith({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correcthorse1",
      });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login?registered=1");
    });
  });

  it("AC2: shows a specific message when the email is already registered", async () => {
    vi.mocked(registerRequest).mockRejectedValue(
      new ApiError(409, "An account with this email already exists.", "EMAIL_ALREADY_EXISTS"),
    );

    render(<RegisterForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(
        screen.getByText("An account with this email already exists."),
      ).toBeInTheDocument();
    });
  });
});
