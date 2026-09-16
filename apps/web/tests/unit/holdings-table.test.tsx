import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { HoldingDto } from "@capitalflow/shared-types";
import { HoldingsTable } from "@/components/app/portfolio/HoldingsTable";
import { getPortfolioHoldings } from "@/lib/portfolio/portfolio-client";

vi.mock("@/lib/portfolio/portfolio-client", () => ({
  getPortfolioHoldings: vi.fn(),
}));

function holding(overrides: Partial<HoldingDto> & Pick<HoldingDto, "symbol">): HoldingDto {
  return {
    assetClass: "equity",
    quantity: "10",
    averagePrice: "100.00",
    currentPrice: "110.00",
    isPriceStale: false,
    marketValue: "1100.00",
    unrealizedProfit: "100.00",
    unrealizedProfitPercent: "10.00",
    ...overrides,
  };
}

describe("HoldingsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC23: shows a loading state before the response arrives", () => {
    vi.mocked(getPortfolioHoldings).mockReturnValue(new Promise(() => {}));

    render(<HoldingsTable />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC24: shows an error state with a retry action on failure", async () => {
    vi.mocked(getPortfolioHoldings).mockRejectedValueOnce(new Error("network error"));

    render(<HoldingsTable />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your active holdings.",
    );

    vi.mocked(getPortfolioHoldings).mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(getPortfolioHoldings).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("You don't have any active holdings yet.")).toBeInTheDocument();
  });

  it("AC27: renders one row per holding with formatted money fields", async () => {
    vi.mocked(getPortfolioHoldings).mockResolvedValue([
      holding({ symbol: "AAPL" }),
    ]);

    render(<HoldingsTable />);

    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("$100.00")).toHaveLength(2); // averagePrice and unrealizedProfit
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText("$1,100.00")).toBeInTheDocument();
    expect(screen.queryByText("price may be outdated")).not.toBeInTheDocument();
  });

  it("AC27: shows a stale-price indicator when isPriceStale is true", async () => {
    vi.mocked(getPortfolioHoldings).mockResolvedValue([
      holding({ symbol: "TSLA", isPriceStale: true }),
    ]);

    render(<HoldingsTable />);

    expect(await screen.findByText("price may be outdated")).toBeInTheDocument();
  });
});
