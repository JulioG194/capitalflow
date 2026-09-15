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

    const select = screen.getByLabelText("Símbolo") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual(INVESTABLE_SYMBOLS);
    expect(screen.getByLabelText("Monto a invertir")).toBeInTheDocument();
  });

  it("AC24: displays the fetched cashBalance via formatMoney", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "5000.00" }));

    render(<InvestForm />);

    expect(await screen.findByText("$5,000.00")).toBeInTheDocument();
  });

  it("AC24: disables Invertir with a visible message when the amount exceeds the balance", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "100.00" }));

    render(<InvestForm />);
    await screen.findByText("$100.00");

    fireEvent.change(screen.getByLabelText("Monto a invertir"), { target: { value: "150.00" } });

    expect(screen.getByRole("alert")).toHaveTextContent("supera tu efectivo disponible");
    expect(screen.getByRole("button", { name: "Invertir" })).toBeDisabled();
  });

  it("AC25: clicking Invertir with a valid symbol/amount opens the confirm modal", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(summary({ cashBalance: "1000.00" }));

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    fireEvent.change(screen.getByLabelText("Monto a invertir"), { target: { value: "100.00" } });
    expect(screen.getByRole("button", { name: "Invertir" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Invertir" }));

    expect(await screen.findByRole("dialog", { name: "Confirmar inversión" })).toBeInTheDocument();
  });

  it("AC27: a successful invest refetches the balance without a full page reload", async () => {
    vi.mocked(getPortfolioSummary)
      .mockResolvedValueOnce(summary({ cashBalance: "1000.00" }))
      .mockResolvedValueOnce(summary({ cashBalance: "900.00" }));
    vi.mocked(investInPortfolio).mockResolvedValue(summary({ cashBalance: "900.00" }));

    render(<InvestForm />);
    await screen.findByText("$1,000.00");

    fireEvent.change(screen.getByLabelText("Monto a invertir"), { target: { value: "100.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Invertir" }));
    await screen.findByRole("dialog", { name: "Confirmar inversión" });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByText("Inversión simulada realizada");

    await waitFor(
      () => {
        expect(screen.getByText("$900.00")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(getPortfolioSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
