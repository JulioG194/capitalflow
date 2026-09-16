"use client"; // fetches GET /portfolio with the in-memory access token (spec 002 AC41); a Server Component can't attach it

import { useCallback, useEffect, useState } from "react";
import { formatMoney, type PortfolioSummaryDto } from "@capitalflow/shared-types";
import { getPortfolioSummary } from "@/lib/portfolio/portfolio-client";
import { classifySign, type Sign } from "@/lib/portfolio/sign";
import { PortfolioSkeleton } from "@/components/app/portfolio/PortfolioSkeleton";
import { PortfolioErrorState } from "@/components/app/portfolio/PortfolioErrorState";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PortfolioSummaryDto };

const SIGN_TEXT_CLASS: Record<Sign, string> = {
  negative: "text-red-600",
  zero: "text-ink",
  positive: "text-green-700",
};

/**
 * AC25: cash/total balance/profit cards + ROI. `cashBalance`, `totalBalance`,
 * `totalProfit` go through `formatMoney`; `roiPercent` is rendered as a plain
 * percentage string instead. `totalProfit`/`roiPercent` are color-coded by
 * sign so gain vs. loss is visually obvious at a glance.
 */
export function PortfolioSummary() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    getPortfolioSummary()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PortfolioSkeleton label="Loading available cash" />
        <PortfolioSkeleton label="Loading total balance" />
        <PortfolioSkeleton label="Loading profit and return" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <PortfolioErrorState message="We couldn't load your portfolio summary." onRetry={load} />
    );
  }

  const { cashBalance, totalBalance, totalProfit, roiPercent } = state.data;
  const sign = classifySign(totalProfit);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-muted">Available cash</h3>
        <p className="mt-2 text-xl font-bold text-ink">{formatMoney(cashBalance)}</p>
      </article>

      <article className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-muted">Total balance</h3>
        <p className="mt-2 text-xl font-bold text-ink">{formatMoney(totalBalance)}</p>
      </article>

      <article className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-muted">Profit / loss</h3>
        <p className={`mt-2 text-xl font-bold ${SIGN_TEXT_CLASS[sign]}`}>
          {formatMoney(totalProfit)}
        </p>
        <p className={`text-sm font-medium ${SIGN_TEXT_CLASS[sign]}`}>ROI: {roiPercent}%</p>
      </article>
    </div>
  );
}
