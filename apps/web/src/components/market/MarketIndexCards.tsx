"use client"; // holds live socket state via useMarketSocket

import { MARKET_SYMBOL_GROUPS } from "@capitalflow/shared-types";
import { formatMoney } from "@/lib/format-money";
import { formatChangePercent, getChangeDirection } from "@/lib/market/format";
import { useMarketSocket } from "@/lib/market/use-market-socket";
import { MarketSkeletonBlock } from "@/components/market/MarketSkeletonBlock";

const INDEX_SYMBOLS = MARKET_SYMBOL_GROUPS.indices.map((index) => index.symbol);

/**
 * AC29: 4 index cards labeled "S&P 500", "NASDAQ", "DOW", "BTC/USD". The
 * first three are sourced from their tracking-ETF proxies (SPY/QQQ/DIA),
 * but the card always renders the index `label` — the underlying ETF
 * `symbol` is never shown as user-facing copy.
 */
export function MarketIndexCards() {
  const { quotes } = useMarketSocket(INDEX_SYMBOLS);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {MARKET_SYMBOL_GROUPS.indices.map(({ label, symbol }) => {
        const quote = quotes[symbol];
        return (
          <article
            key={symbol}
            className="rounded-card border border-gray-100 bg-white p-4 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-ink-muted">{label}</h3>
            {quote ? (
              <>
                <p className="mt-2 text-xl font-bold text-ink">
                  {formatMoney(quote.price)}
                </p>
                <p
                  className={`text-sm font-medium ${
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
                className="mt-2 h-14"
                aria-label={`Loading ${label}`}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
