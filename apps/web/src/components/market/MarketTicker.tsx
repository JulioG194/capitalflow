"use client"; // holds live socket state via useMarketSocket

import { MARKET_SYMBOL_GROUPS } from "@capitalflow/shared-types";
import { formatMoney } from "@/lib/format-money";
import { formatChangePercent, getChangeDirection } from "@/lib/market/format";
import { useMarketSocket } from "@/lib/market/use-market-socket";
import { MarketSkeletonBlock } from "@/components/market/MarketSkeletonBlock";

/**
 * AC28: ticker bar showing the 6 configured ticker symbols with price and
 * change for each. AC26: renders an explicit skeleton per symbol until its
 * first `quote:update` arrives, never a blank/zero/fabricated value.
 */
export function MarketTicker() {
  const { quotes } = useMarketSocket(MARKET_SYMBOL_GROUPS.ticker);

  return (
    <ul
      aria-label="Cotizaciones en vivo"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {MARKET_SYMBOL_GROUPS.ticker.map((symbol) => {
        const quote = quotes[symbol];
        return (
          <li
            key={symbol}
            className="rounded-card border border-gray-100 bg-white p-3 shadow-sm"
          >
            <p className="text-xs font-semibold text-ink-muted">{symbol}</p>
            {quote ? (
              <>
                <p className="mt-1 text-base font-semibold text-ink">
                  {formatMoney(quote.price)}
                </p>
                <p
                  className={`text-xs font-medium ${
                    getChangeDirection(quote.change) === "down"
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {formatChangePercent(quote.changePercent)}
                </p>
              </>
            ) : (
              <MarketSkeletonBlock
                className="mt-1 h-9"
                aria-label={`Cargando ${symbol}`}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
