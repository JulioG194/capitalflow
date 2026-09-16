import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { forgotPasswordRequest } from "@/lib/auth/auth-client";

vi.mock("@/lib/auth/auth-client", () => ({
  forgotPasswordRequest: vi.fn(),
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC37: blocks submission on an invalid email", async () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(forgotPasswordRequest).not.toHaveBeenCalled();
    });
  });

  it("AC20/AC21/AC36/AC43: shows the same generic confirmation for any submitted email", async () => {
    vi.mocked(forgotPasswordRequest).mockResolvedValue({
      message: "If that email exists, a reset link has been sent",
    });

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(forgotPasswordRequest).toHaveBeenCalledWith({ email: "ada@example.com" });
    });
    expect(
      await screen.findByText(/we sent a link to reset your password/i),
    ).toBeInTheDocument();
  });
});
