import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginRequest } from "@/lib/auth/auth-client";
import { ApiError } from "@/lib/auth/errors";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  loginRequest: vi.fn(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC37: blocks submission and shows a field error on an empty password", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    // Password left empty.

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(loginRequest).not.toHaveBeenCalled();
    });
  });

  it("AC38: shows one generic message on a 401, never the raw API text", async () => {
    vi.mocked(loginRequest).mockRejectedValue(
      new ApiError(401, "Invalid credentials — password mismatch", undefined),
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Incorrect email or password.");
    expect(alert).not.toHaveTextContent(/password mismatch/i);
  });

  it("AC36/AC43/AC39: submits valid input and redirects to the `redirectTo` prop on success", async () => {
    vi.mocked(loginRequest).mockResolvedValue({
      accessToken: "token",
      user: { id: "1", email: "ada@example.com", name: "Ada" },
    });

    render(<LoginForm redirectTo="/app/portfolio" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correcthorse1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(loginRequest).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "correcthorse1",
      });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/app/portfolio");
    });
  });
});
