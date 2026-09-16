"use client"; // fetches GET /portfolio/transactions with the in-memory access token (spec 002 AC41) and holds pagination state; a Server Component can't attach the token or hold interactive state

import { useCallback, useEffect, useState } from "react";
import { formatMoney, type PaginatedTransactionsDto } from "@capitalflow/shared-types";
import { getPortfolioTransactions } from "@/lib/portfolio/portfolio-client";
import { TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/portfolio/labels";
import { PortfolioSkeleton } from "@/components/app/portfolio/PortfolioSkeleton";
import { PortfolioErrorState } from "@/components/app/portfolio/PortfolioErrorState";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PaginatedTransactionsDto };

const PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * AC28/AC29: one row per transaction (type, symbol/quantity or "—" when
 * `null`, amount via `formatMoney`, status, createdAt as a readable
 * date/time) plus pagination controls that re-fetch `GET
 * /portfolio/transactions` with the new `page` on every page change.
 */
export function TransactionHistory() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback((targetPage: number) => {
    setState({ status: "loading" });
    getPortfolioTransactions(targetPage, PAGE_SIZE)
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  if (state.status === "loading") {
    return (
      <PortfolioSkeleton className="h-48 rounded-card" label="Loading transaction history" />
    );
  }

  if (state.status === "error") {
    return (
      <PortfolioErrorState
        message="We couldn't load your transaction history."
        onRetry={() => load(page)}
      />
    );
  }

  const { items, totalPages } = state.data;

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-gray-100 bg-white px-4 py-6 text-sm text-ink-muted">
        You don&apos;t have any transactions yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-card border border-gray-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">
                Type
              </th>
              <th scope="col" className="px-4 py-3">
                Symbol
              </th>
              <th scope="col" className="px-4 py-3">
                Quantity
              </th>
              <th scope="col" className="px-4 py-3">
                Amount
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 text-ink">{TRANSACTION_TYPE_LABELS[tx.type]}</td>
                <td className="px-4 py-3 text-ink">{tx.symbol ?? "—"}</td>
                <td className="px-4 py-3 text-ink">{tx.quantity ?? "—"}</td>
                <td className="px-4 py-3 text-ink">{formatMoney(tx.amount)}</td>
                <td className="px-4 py-3 text-ink">{TRANSACTION_STATUS_LABELS[tx.status]}</td>
                <td className="px-4 py-3 text-ink">
                  {dateFormatter.format(new Date(tx.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>
          Page {page} of {totalPages || 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-card border border-gray-200 px-3 py-1.5 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= totalPages}
            className="rounded-card border border-gray-200 px-3 py-1.5 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
