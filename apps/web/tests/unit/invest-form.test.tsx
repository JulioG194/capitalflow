import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { PortfolioSummaryDto } from "@capitalflow/shared-types";
import { INVESTABLE_SYMBOLS } from "@capitalflow/shared-types";
import { InvestForm } from "@/components/app/invest/InvestForm";
import { getPortfolioSummary, investInPortfolio } from "@/lib/portfolio/portfolio-client";

vi.mock("@/lib/portfolio/portfolio-client", () => ({
  getPortfolioSummary: vi.fn(),
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

function summary(overrides: Partial<PortfolioSummaryDto> = {}): PortfolioSummaryDto {
  return {
    cashBalance: "1000.00",
    holdingsValue: "0.00",
    totalBalance: "1000.00",
    totalDeposited: "1000.00",
    totalProfit: "0.00",
    roiPercent: "0.00",
    allocation: [{ assetClass: "cash", value: "1000.00", percentage: "100.00" }],
    asOf: new Date().toISOString(),
    ...overrides,
  };
}

describe("InvestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC23: renders a symbol selector constrained to INVESTABLE_SYMBOLS and an amount input", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary());

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    const select = screen.getByLabelText("Symbol") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual(INVESTABLE_SYMBOLS);
    expect(screen.getByLabelText("Amount to invest")).toBeInTheDocument();
  });

  it("AC24: displays the fetched cashBalance via formatMoney", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "5000.00" }));

    render(<InvestForm />);

    expect(await screen.findByText("$5,000.00")).toBeInTheDocument();
  });

  it("AC24: disables Invest with a visible message when the amount exceeds the balance", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "100.00" }));

    render(<InvestForm />);
    await screen.findByText("$100.00");

    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "150.00" } });

    expect(screen.getByRole("alert")).toHaveTextContent("exceeds your available cash");
    expect(screen.getByRole("button", { name: "Invest" })).toBeDisabled();
  });

  it("AC25: clicking Invest with a valid symbol/amount opens the confirm modal", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "1000.00" }));

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "100.00" } });
    expect(screen.getByRole("button", { name: "Invest" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Invest" }));

    expect(await screen.findByRole("dialog", { name: "Confirm investment" })).toBeInTheDocument();
  });

  it("AC27: a successful invest refetches the balance without a full page reload", async () => {
    vi.mocked(getPortfolioSummary)
      .mockResolvedValueOnce(summary({ cashBalance: "1000.00" }))
      .mockResolvedValueOnce(summary({ cashBalance: "900.00" }));
    vi.mocked(investInPortfolio).mockResolvedValue(summary({ cashBalance: "900.00" }));

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "100.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Invest" }));
    await screen.findByRole("dialog", { name: "Confirm investment" });

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByText("Simulated investment placed");

    await waitFor(
      () => {
        expect(screen.getByText("$900.00")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(getPortfolioSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AC31: closing the modal on an in-flight request and reopening for a new attempt sends an independent request", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "1000.00" }));
    // The first call never resolves within this test — it simulates a
    // request the user navigates away from mid-flight (AC31's first
    // sentence: the in-flight request is left running, never cancelled).
    // The second call resolves normally, standing in for the independent
    // retry (AC31's second sentence).
    vi.mocked(investInPortfolio)
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(summary({ cashBalance: "900.00" }));

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "100.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Invest" }));
    await screen.findByRole("dialog", { name: "Confirm investment" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    // Close (simulating "navigate away") while the first call is still pending.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reopen for a new attempt — this must be a fresh component instance
    // firing a brand-new call, never resubmitting/reusing the first promise.
    fireEvent.click(screen.getByRole("button", { name: "Invest" }));
    await screen.findByRole("dialog", { name: "Confirm investment" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByText("Simulated investment placed");

    const defaultSymbol = INVESTABLE_SYMBOLS[0];
    expect(investInPortfolio).toHaveBeenCalledTimes(2);
    expect(investInPortfolio).toHaveBeenNthCalledWith(1, { symbol: defaultSymbol, amount: "100.00" });
    expect(investInPortfolio).toHaveBeenNthCalledWith(2, { symbol: defaultSymbol, amount: "100.00" });
  });
});
