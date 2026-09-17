"use client"; // holds live socket + chart history state

import { useEffect, useMemo, useState } from "react";
import type { ChartHistoryEvent } from "@capitalflow/shared-types";
import { MARKET_SYMBOL_GROUPS } from "@capitalflow/shared-types";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAccessToken } from "@/lib/auth/token-store";
import { formatMoney } from "@/lib/format-money";
import { useMarketSocket } from "@/lib/market/use-market-socket";
import { subscribeToHistory } from "@/lib/market/market-socket-manager";
import { MarketSkeletonBlock } from "@/components/market/MarketSkeletonBlock";

type ChartPoint = { at: number; price: number };

const DEFAULT_SYMBOL = MARKET_SYMBOL_GROUPS.ticker[0] ?? "AAPL";

/**
 * Spec 003 AC30/AC31: trailing-24h line chart from self-accumulated ticks.
 * Labels a shorter window when history is still filling after deploy.
 */
export function MarketChart() {
  const { isAuthenticated } = useAuth();
  const [symbol] = useState(DEFAULT_SYMBOL);
  const { quotes } = useMarketSocket([symbol]);
  const [history, setHistory] = useState<ChartHistoryEvent | null>(null);
  const [livePoints, setLivePoints] = useState<ChartPoint[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;
    return subscribeToHistory(token, symbol, (event) => {
      setHistory(event);
      setLivePoints([]);
    });
  }, [isAuthenticated, symbol]);

  useEffect(() => {
    const quote = quotes[symbol];
    if (!quote) return;
    const at = Date.parse(quote.timestamp);
    const price = Number(quote.price);
    if (!Number.isFinite(at) || !Number.isFinite(price)) return;
    setLivePoints((prev) => {
      const next = [...prev, { at, price }];
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return next.filter((p) => p.at >= cutoff).slice(-500);
    });
  }, [quotes, symbol]);

  const points = useMemo(() => {
    const fromHistory: ChartPoint[] = (history?.points ?? [])
      .map((p) => ({ at: Date.parse(p.timestamp), price: Number(p.price) }))
      .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.price));
    const merged = [...fromHistory, ...livePoints].sort((a, b) => a.at - b.at);
    const deduped: ChartPoint[] = [];
    for (const point of merged) {
      const last = deduped[deduped.length - 1];
      if (last && last.at === point.at) {
        deduped[deduped.length - 1] = point;
      } else {
        deduped.push(point);
      }
    }
    return deduped;
  }, [history, livePoints]);

  const path = useMemo(() => buildPolyline(points), [points]);
  const ready = history !== null || points.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{symbol} · 24h</h3>
        {history?.partialWindow ? (
          <p className="text-xs text-ink-muted">
            Showing accumulated range so far (less than 24 hours)
          </p>
        ) : null}
      </div>

      {!ready ? (
        <MarketSkeletonBlock className="h-48 w-full" aria-label="Loading chart" />
      ) : points.length < 2 ? (
        <p className="flex h-48 items-center justify-center text-sm text-ink-muted">
          Waiting for live ticks to build the chart…
          {quotes[symbol] ? ` Last ${formatMoney(quotes[symbol]!.price)}` : null}
        </p>
      ) : (
        <svg
          viewBox="0 0 400 180"
          className="h-48 w-full"
          role="img"
          aria-label={`${symbol} price chart`}
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink"
            points={path}
          />
        </svg>
      )}
    </div>
  );
}

function buildPolyline(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  const minX = points[0]!.at;
  const maxX = points[points.length - 1]!.at;
  const prices = points.map((p) => p.price);
  const minY = Math.min(...prices);
  const maxY = Math.max(...prices);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 0.0001);
  const pad = 8;
  return points
    .map((p) => {
      const x = pad + ((p.at - minX) / spanX) * (400 - pad * 2);
      const y = 180 - pad - ((p.price - minY) / spanY) * (180 - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
