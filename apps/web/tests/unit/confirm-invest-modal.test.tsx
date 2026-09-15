import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PortfolioSummaryDto } from "@capitalflow/shared-types";
import { ConfirmInvestModal } from "@/components/app/invest/ConfirmInvestModal";
import { investInPortfolio, ApiError } from "@/lib/portfolio/portfolio-client";

function summary(): PortfolioSummaryDto {
  return {
    cashBalance: "900.00",
    holdingsValue: "100.00",
    totalBalance: "1000.00",
    totalDeposited: "1000.00",
    totalProfit: "0.00",
    roiPercent: "0.00",
    allocation: [{ assetClass: "cash", value: "900.00", percentage: "90.00" }],
    asOf: new Date().toISOString(),
  };
}

vi.mock("@/lib/portfolio/portfolio-client", () => ({
  investInPortfolio: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    retryAfterSeconds?: number;
    constructor(status: number, message: string, code?: string, retryAfterSeconds?: number) {
      super(message);
      this.status = status;
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));

describe("ConfirmInvestModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC25: shows the selected symbol, amount via formatMoney, and simulated-investing copy", () => {
    render(
      <ConfirmInvestModal symbol="AAPL" amount="250.5" onClose={vi.fn()} onInvested={vi.fn()} />,
    );

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("$250.50")).toBeInTheDocument();
    expect(screen.getByText(/no se mueve dinero real/)).toBeInTheDocument();
  });

  it("AC26: disables the Confirmar button for the duration of the request", async () => {
    let resolveInvest: (value: PortfolioSummaryDto) => void = () => {};
    vi.mocked(investInPortfolio).mockReturnValue(
      new Promise<PortfolioSummaryDto>((resolve) => {
        resolveInvest = resolve;
      }),
    );

    render(
      <ConfirmInvestModal symbol="AAPL" amount="100.00" onClose={vi.fn()} onInvested={vi.fn()} />,
    );

    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmButton);

    expect(screen.getByRole("button", { name: "Confirmando…" })).toBeDisabled();
    expect(investInPortfolio).toHaveBeenCalledTimes(1);

    // A second click while still submitting must not fire a second request.
    fireEvent.click(screen.getByRole("button", { name: "Confirmando…" }));
    expect(investInPortfolio).toHaveBeenCalledTimes(1);

    resolveInvest(summary());
    await screen.findByText("Inversión simulada realizada");
  });

  it("AC28: on INSUFFICIENT_FUNDS, stays open, shows an insufficient-funds message, and keeps the amount", async () => {
    vi.mocked(investInPortfolio).mockRejectedValue(
      new ApiError(422, "Insufficient funds", "INSUFFICIENT_FUNDS"),
    );
    const onClose = vi.fn();

    render(
      <ConfirmInvestModal symbol="AAPL" amount="100.00" onClose={onClose} onInvested={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes suficiente efectivo simulado",
    );
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("AC29: on PRICE_UNAVAILABLE, stays open with a retry-oriented message and keeps symbol/amount", async () => {
    vi.mocked(investInPortfolio).mockRejectedValue(
      new ApiError(503, "Price unavailable", "PRICE_UNAVAILABLE"),
    );

    render(
      <ConfirmInvestModal symbol="TSLA" amount="50.00" onClose={vi.fn()} onInvested={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Inténtalo de nuevo");
    expect(screen.getByText("TSLA")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("AC30: on a 429, shows a too-many-attempts message deriving a wait time from retryAfterSeconds", async () => {
    vi.mocked(investInPortfolio).mockRejectedValue(
      new ApiError(429, "Too many requests", undefined, 42),
    );

    render(
      <ConfirmInvestModal symbol="AAPL" amount="100.00" onClose={vi.fn()} onInvested={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("demasiados intentos");
    expect(alert).toHaveTextContent("42 segundos");
  });

  it("AC31: does not update state (no error thrown) after unmounting mid-request", async () => {
    let resolveInvest: (value: PortfolioSummaryDto) => void = () => {};
    vi.mocked(investInPortfolio).mockReturnValue(
      new Promise<PortfolioSummaryDto>((resolve) => {
        resolveInvest = resolve;
      }),
    );

    const { unmount } = render(
      <ConfirmInvestModal symbol="AAPL" amount="100.00" onClose={vi.fn()} onInvested={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(investInPortfolio).toHaveBeenCalledTimes(1);

    unmount();

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Resolving after unmount must not throw, and must not trigger React's
    // "Can't perform a state update on an unmounted component" warning.
    expect(() => resolveInvest(summary())).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
