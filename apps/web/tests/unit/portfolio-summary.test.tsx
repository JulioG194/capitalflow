import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { PortfolioSummaryDto } from "@capitalflow/shared-types";
import { PortfolioSummary } from "@/components/app/portfolio/PortfolioSummary";
import { getPortfolioSummary } from "@/lib/portfolio/portfolio-client";

vi.mock("@/lib/portfolio/portfolio-client", () => ({
  getPortfolioSummary: vi.fn(),
}));

function summary(overrides: Partial<PortfolioSummaryDto> = {}): PortfolioSummaryDto {
  return {
    cashBalance: "10000.00",
    holdingsValue: "0.00",
    totalBalance: "10000.00",
    totalDeposited: "10000.00",
    totalProfit: "0.00",
    roiPercent: "0.00",
    allocation: [{ assetClass: "cash", value: "10000.00", percentage: "100.00" }],
    asOf: new Date().toISOString(),
    ...overrides,
  };
}

describe("PortfolioSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC23: shows a loading state before the response arrives", () => {
    vi.mocked(getPortfolioSummary).mockReturnValue(new Promise(() => {}));

    render(<PortfolioSummary />);

    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("AC24: shows an error state with a retry action on failure", async () => {
    vi.mocked(getPortfolioSummary).mockRejectedValueOnce(new Error("network error"));

    render(<PortfolioSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el resumen de tu cartera.",
    );

    vi.mocked(getPortfolioSummary).mockResolvedValueOnce(summary());
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(getPortfolioSummary).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findAllByText("$10,000.00")).length).toBeGreaterThan(0);
  });

  it("AC25: formats money via formatMoney and roiPercent as a plain percentage, colored positive", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(
      summary({
        cashBalance: "5000.00",
        totalBalance: "12345.67",
        totalProfit: "2345.67",
        roiPercent: "23.46",
      }),
    );

    render(<PortfolioSummary />);

    expect(await screen.findByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("$12,345.67")).toBeInTheDocument();
    const profit = screen.getByText("$2,345.67");
    expect(profit).toHaveClass("text-green-700");
    expect(screen.getByText("ROI: 23.46%")).toHaveClass("text-green-700");
  });

  it("AC25: colors a loss (negative sign) in red", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(
      summary({ totalProfit: "-500.00", roiPercent: "-5.00" }),
    );

    render(<PortfolioSummary />);

    const profit = await screen.findByText("-$500.00");
    expect(profit).toHaveClass("text-red-600");
    expect(screen.getByText("ROI: -5.00%")).toHaveClass("text-red-600");
  });
});
