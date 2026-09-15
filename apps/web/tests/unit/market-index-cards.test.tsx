import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type QuoteDto } from "@capitalflow/shared-types";
import { MarketIndexCards } from "@/components/market/MarketIndexCards";

const { mockUseMarketSocket } = vi.hoisted(() => ({
  mockUseMarketSocket: vi.fn(),
}));

vi.mock("@/lib/market/use-market-socket", () => ({
  useMarketSocket: mockUseMarketSocket,
}));

function quote(overrides: Partial<QuoteDto> & Pick<QuoteDto, "symbol">): QuoteDto {
  return {
    price: "100.00",
    change: "-1.00",
    changePercent: "-1.00",
    timestamp: new Date().toISOString(),
    delayed: true,
    delayMinutes: 15,
    ...overrides,
  };
}

describe("MarketIndexCards", () => {
  it("renders the 4 index labels, never the underlying ETF ticker (AC29)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: {},
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketIndexCards />);

    expect(screen.getByText("S&P 500")).toBeInTheDocument();
    expect(screen.getByText("NASDAQ")).toBeInTheDocument();
    expect(screen.getByText("DOW")).toBeInTheDocument();
    expect(screen.getByText("BTC/USD")).toBeInTheDocument();
    expect(screen.queryByText("SPY")).not.toBeInTheDocument();
    expect(screen.queryByText("QQQ")).not.toBeInTheDocument();
    expect(screen.queryByText("DIA")).not.toBeInTheDocument();
  });

  it("shows a skeleton per card before any quote arrives (AC26)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: {},
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketIndexCards />);

    expect(screen.getAllByRole("status")).toHaveLength(4);
  });

  it("renders price and negative change styling once a quote arrives (AC29)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: { SPY: quote({ symbol: "SPY", price: "512.34", changePercent: "-0.42" }) },
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketIndexCards />);

    expect(screen.getByText(/512,34/)).toBeInTheDocument();
    expect(screen.getByText("-0.42%")).toBeInTheDocument();
  });
});
