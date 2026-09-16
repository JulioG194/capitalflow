import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resetPasswordRequest } from "@/lib/auth/auth-client";
import { ApiError } from "@/lib/auth/errors";

vi.mock("@/lib/auth/auth-client", () => ({
  resetPasswordRequest: vi.fn(),
}));

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a fixed invalid-link message and no form when the token is missing", () => {
    render(<ResetPasswordForm token="" />);

    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("AC37/AC44: blocks submission when the new password fails the shared complexity rule", async () => {
    render(<ResetPasswordForm token="valid-token" />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPasswordRequest).not.toHaveBeenCalled();
    });
  });

  it("AC36/AC43: submits the token and new password together", async () => {
    vi.mocked(resetPasswordRequest).mockResolvedValue({ message: "ok" });

    render(<ResetPasswordForm token="valid-token" />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correcthorse1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPasswordRequest).toHaveBeenCalledWith({
        token: "valid-token",
        newPassword: "correcthorse1",
      });
    });
    expect(await screen.findByText(/password was updated/i)).toBeInTheDocument();
  });

  it("AC23: shows one fixed message for any reset failure (invalid or expired)", async () => {
    vi.mocked(resetPasswordRequest).mockRejectedValue(
      new ApiError(400, "Token has already been used", undefined),
    );

    render(<ResetPasswordForm token="valid-token" />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correcthorse1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This link is invalid or has expired. Request a new one.");
  });
});
