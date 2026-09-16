import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MARKET_SYMBOL_GROUPS, type QuoteDto } from "@capitalflow/shared-types";
import { MarketTicker } from "@/components/market/MarketTicker";

const { mockUseMarketSocket } = vi.hoisted(() => ({
  mockUseMarketSocket: vi.fn(),
}));

vi.mock("@/lib/market/use-market-socket", () => ({
  useMarketSocket: mockUseMarketSocket,
}));

function quote(overrides: Partial<QuoteDto> & Pick<QuoteDto, "symbol">): QuoteDto {
  return {
    price: "100.00",
    change: "1.00",
    changePercent: "1.00",
    timestamp: new Date().toISOString(),
    delayed: true,
    delayMinutes: 15,
    ...overrides,
  };
}

describe("MarketTicker", () => {
  it("renders a skeleton for every symbol before any quote arrives (AC26)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: {},
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketTicker />);

    const skeletons = screen.getAllByRole("status");
    expect(skeletons).toHaveLength(MARKET_SYMBOL_GROUPS.ticker.length);
  });

  it("renders every configured ticker symbol (AC28)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: {},
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketTicker />);

    for (const symbol of MARKET_SYMBOL_GROUPS.ticker) {
      expect(screen.getByText(symbol)).toBeInTheDocument();
    }
  });

  it("renders price and change once a symbol has a quote (AC28)", () => {
    mockUseMarketSocket.mockReturnValue({
      quotes: { AAPL: quote({ symbol: "AAPL", price: "189.50", changePercent: "1.25" }) },
      status: "connected",
      hasConnectedOnce: true,
    });

    render(<MarketTicker />);

    expect(screen.getByText("$189.50")).toBeInTheDocument();
    expect(screen.getByText("+1.25%")).toBeInTheDocument();
  });
});
