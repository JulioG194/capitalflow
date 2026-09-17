"use client"; // holds live socket state via useMarketSocket

import { MARKET_SYMBOL_GROUPS } from "@capitalflow/shared-types";
import { formatMoney } from "@/lib/format-money";
import { formatChangePercent, getChangeDirection } from "@/lib/market/format";
import { useMarketSocket } from "@/lib/market/use-market-socket";
import { MarketSkeletonBlock } from "@/components/market/MarketSkeletonBlock";

/**
 * Spec 003 AC32: featured-stocks table with symbol, price, change, change
 * percent, and last-updated time. AC26: skeleton rows until first quote.
 */
export function MarketFeaturedTable() {
  const symbols = MARKET_SYMBOL_GROUPS.featured;
  const { quotes } = useMarketSocket(symbols);

  return (
    <div className="overflow-x-auto rounded-card border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Symbol</th>
            <th className="px-4 py-3 font-semibold">Price</th>
            <th className="px-4 py-3 font-semibold">Change</th>
            <th className="px-4 py-3 font-semibold">Change %</th>
            <th className="px-4 py-3 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => {
            const quote = quotes[symbol];
            return (
              <tr key={symbol} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{symbol}</td>
                {quote ? (
                  <>
                    <td className="px-4 py-3 text-ink">
                      {formatMoney(quote.price)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        getChangeDirection(quote.change) === "down"
                          ? "text-red-600"
                          : "text-green-700"
                      }`}
                    >
                      {formatMoney(quote.change)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        getChangeDirection(quote.change) === "down"
                          ? "text-red-600"
                          : "text-green-700"
                      }`}
                    >
                      {formatChangePercent(quote.changePercent)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(quote.timestamp).toLocaleTimeString()}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="px-4 py-3">
                    <MarketSkeletonBlock
                      className="h-5 w-full"
                      aria-label={`Loading ${symbol}`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
