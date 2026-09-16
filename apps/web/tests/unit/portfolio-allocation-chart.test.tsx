import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { PortfolioSummaryDto } from "@capitalflow/shared-types";
import { PortfolioAllocationChart } from "@/components/app/portfolio/PortfolioAllocationChart";
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

describe("PortfolioAllocationChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC23: shows a loading state before the response arrives", () => {
    vi.mocked(getPortfolioSummary).mockReturnValue(new Promise(() => {}));

    render(<PortfolioAllocationChart />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC24: shows an error state with a retry action on failure", async () => {
    vi.mocked(getPortfolioSummary).mockRejectedValueOnce(new Error("network error"));

    render(<PortfolioAllocationChart />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your portfolio allocation.",
    );

    vi.mocked(getPortfolioSummary).mockResolvedValueOnce(summary());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(getPortfolioSummary).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole("img")).toBeInTheDocument();
  });

  it("AC26: renders one legend entry per allocation slice, labeled with asset class and percentage", async () => {
    vi.mocked(getPortfolioSummary).mockResolvedValue(
      summary({
        allocation: [
          { assetClass: "equity", value: "6000.00", percentage: "60.00" },
          { assetClass: "cash", value: "4000.00", percentage: "40.00" },
        ],
      }),
    );

    render(<PortfolioAllocationChart />);

    expect(await screen.findByText("Equities — 60.00%")).toBeInTheDocument();
    expect(screen.getByText("Cash — 40.00%")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
