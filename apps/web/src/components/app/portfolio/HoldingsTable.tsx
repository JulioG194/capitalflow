"use client"; // fetches GET /portfolio/holdings with the in-memory access token (spec 002 AC41); a Server Component can't attach it

import { useCallback, useEffect, useState } from "react";
import { formatMoney, type HoldingDto } from "@capitalflow/shared-types";
import { getPortfolioHoldings } from "@/lib/portfolio/portfolio-client";
import { ASSET_CLASS_LABELS } from "@/lib/portfolio/labels";
import { classifySign, type Sign } from "@/lib/portfolio/sign";
import { PortfolioSkeleton } from "@/components/app/portfolio/PortfolioSkeleton";
import { PortfolioErrorState } from "@/components/app/portfolio/PortfolioErrorState";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: HoldingDto[] };

const SIGN_TEXT_CLASS: Record<Sign, string> = {
  negative: "text-red-600",
  zero: "text-ink",
  positive: "text-green-700",
};

/**
 * AC27: one row per active holding — `symbol`, `quantity`, `averagePrice`,
 * `currentPrice`, `marketValue`, `unrealizedProfit` — with every monetary
 * field formatted via `formatMoney` (`quantity` is a share count, not
 * money, so it's rendered as-is). Rows with `isPriceStale = true` show a
 * visible "price may be outdated" indicator.
 */
export function HoldingsTable() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    getPortfolioHoldings()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return <PortfolioSkeleton className="h-48 rounded-card" label="Cargando posiciones activas" />;
  }

  if (state.status === "error") {
    return (
      <PortfolioErrorState message="No pudimos cargar tus posiciones activas." onRetry={load} />
    );
  }

  if (state.data.length === 0) {
    return (
      <p className="rounded-card border border-gray-100 bg-white px-4 py-6 text-sm text-ink-muted">
        Todavía no tienes posiciones activas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-gray-100 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3">
              Símbolo
            </th>
            <th scope="col" className="px-4 py-3">
              Cantidad
            </th>
            <th scope="col" className="px-4 py-3">
              Precio promedio
            </th>
            <th scope="col" className="px-4 py-3">
              Precio actual
            </th>
            <th scope="col" className="px-4 py-3">
              Valor de mercado
            </th>
            <th scope="col" className="px-4 py-3">
              Ganancia no realizada
            </th>
          </tr>
        </thead>
        <tbody>
          {state.data.map((holding) => {
            const sign = classifySign(holding.unrealizedProfit);
            return (
              <tr key={holding.symbol} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">
                  {holding.symbol}
                  <span className="ml-1 text-xs font-normal text-ink-muted">
                    ({ASSET_CLASS_LABELS[holding.assetClass]})
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">{holding.quantity}</td>
                <td className="px-4 py-3 text-ink">{formatMoney(holding.averagePrice)}</td>
                <td className="px-4 py-3 text-ink">
                  {formatMoney(holding.currentPrice)}
                  {holding.isPriceStale && (
                    <span
                      role="note"
                      className="ml-2 inline-block rounded-card border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900"
                    >
                      precio puede estar desactualizado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">{formatMoney(holding.marketValue)}</td>
                <td className={`px-4 py-3 font-medium ${SIGN_TEXT_CLASS[sign]}`}>
                  {formatMoney(holding.unrealizedProfit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
