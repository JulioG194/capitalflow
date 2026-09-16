"use client"; // fetches GET /portfolio with the in-memory access token (spec 002 AC41); a Server Component can't attach it

import { useCallback, useEffect, useState } from "react";
import type { AllocationSliceDto, PortfolioSummaryDto } from "@capitalflow/shared-types";
import { getPortfolioSummary } from "@/lib/portfolio/portfolio-client";
import { ASSET_CLASS_LABELS } from "@/lib/portfolio/labels";
import { PortfolioSkeleton } from "@/components/app/portfolio/PortfolioSkeleton";
import { PortfolioErrorState } from "@/components/app/portfolio/PortfolioErrorState";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PortfolioSummaryDto };

const SLICE_COLORS = ["#1a44d6", "#22c55e", "#f59e0b", "#ec4899", "#64748b"];

// `BigInt(n)` function calls (not `n`-suffixed literals) so this compiles
// under the project's ES2017 tsconfig target — literal BigInt syntax
// requires ES2020, but the `BigInt` global and bigint arithmetic operators
// themselves are runtime features, not tied to the TS compile target.
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const DEGREES_TIMES_TEN_PER_PERCENT = BigInt(36);
const TEN = BigInt(10);

/**
 * Converts a 2-decimal percentage string (e.g. "42.50") into hundredths of a
 * percentage point as a `bigint` (`4250`). The conic-gradient arc
 * boundaries below are computed with exact integer arithmetic on this value
 * — never JS numeric coercion (AC30 applies to every string field
 * rendered on this page, not only `formatMoney`-formatted ones).
 */
function toHundredths(percentage: string): bigint {
  const [whole, frac = ""] = percentage.trim().split(".");
  return BigInt(whole || "0") * HUNDRED + BigInt(`${frac}00`.slice(0, 2) || "0");
}

/** Formats hundredths-of-a-percent as a one-decimal CSS degree string (100% = 360deg). */
function toDegreeString(hundredths: bigint): string {
  const tenthsOfDegree = (hundredths * DEGREES_TIMES_TEN_PER_PERCENT) / HUNDRED; // degrees * 10
  return `${tenthsOfDegree / TEN}.${tenthsOfDegree % TEN}`;
}

function buildConicGradient(allocation: AllocationSliceDto[]): string {
  let cumulative = ZERO;
  const stops = allocation.map((slice, index) => {
    const start = toDegreeString(cumulative);
    cumulative += toHundredths(slice.percentage);
    const end = toDegreeString(cumulative);
    const color = SLICE_COLORS[index % SLICE_COLORS.length];
    return `${color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

/**
 * AC26: pie chart with exactly one segment per `allocation` slice, each
 * labeled with its asset class and percentage. Built with a plain CSS
 * `conic-gradient` (no new charting dependency, per CLAUDE.md).
 */
export function PortfolioAllocationChart() {
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
      <PortfolioSkeleton
        className="h-40 w-40 rounded-full"
        label="Loading portfolio allocation"
      />
    );
  }

  if (state.status === "error") {
    return (
      <PortfolioErrorState
        message="We couldn't load your portfolio allocation."
        onRetry={load}
      />
    );
  }

  const { allocation } = state.data;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div
        role="img"
        aria-label="Pie chart of portfolio allocation by asset class"
        className="h-40 w-40 shrink-0 rounded-full"
        style={{ background: buildConicGradient(allocation) }}
      />
      <ul className="flex flex-col gap-2">
        {allocation.map((slice, index) => (
          <li key={slice.assetClass} className="flex items-center gap-2 text-sm text-ink">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
            />
            <span>
              {ASSET_CLASS_LABELS[slice.assetClass]} — {slice.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
