"use client"; // fetches GET /portfolio with the in-memory access token (spec 002 AC41) and owns symbol/amount/confirm-modal form state; a Server Component can't attach the token or hold interactive state

import { useCallback, useEffect, useState } from "react";
import { formatMoney, investAmountSchema, INVESTABLE_SYMBOLS } from "@capitalflow/shared-types";
import { getPortfolioSummary } from "@/lib/portfolio/portfolio-client";
import { compareDecimalStrings } from "@/lib/invest/decimal";
import { PortfolioSkeleton } from "@/components/app/portfolio/PortfolioSkeleton";
import { PortfolioErrorState } from "@/components/app/portfolio/PortfolioErrorState";
import { ConfirmInvestModal } from "@/components/app/invest/ConfirmInvestModal";

type BalanceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; cashBalance: string };

const DEFAULT_SYMBOL = INVESTABLE_SYMBOLS[0] ?? "";

/**
 * AC23-AC24: symbol selector constrained to `INVESTABLE_SYMBOLS` (an
 * unsupported symbol is structurally unselectable — there is no free-text
 * symbol input anywhere in this form), an amount input, the fetched
 * `cashBalance` displayed via `formatMoney`, and an "Invest" button
 * disabled with a visible message whenever the entered amount exceeds that
 * balance (a UX guard only — AC5's server-side check remains the sole
 * security boundary). AC25: a valid click opens `<ConfirmInvestModal>`.
 * AC27: on a successful invest, refetches this form's own balance rather
 * than reloading the page.
 */
export function InvestForm() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [amount, setAmount] = useState("");
  const [balanceState, setBalanceState] = useState<BalanceState>({ status: "loading" });
  const [isModalOpen, setModalOpen] = useState(false);

  const loadBalance = useCallback(() => {
    setBalanceState({ status: "loading" });
    getPortfolioSummary()
      .then((data) => setBalanceState({ status: "ready", cashBalance: data.cashBalance }))
      .catch(() => setBalanceState({ status: "error" }));
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const isAmountFormatValid = investAmountSchema.safeParse(amount).success;
  const exceedsBalance =
    isAmountFormatValid && balanceState.status === "ready"
      ? compareDecimalStrings(amount, balanceState.cashBalance) > 0
      : false;

  const canSubmit =
    isAmountFormatValid && balanceState.status === "ready" && symbol !== "" && !exceedsBalance;

  function handleInvestClick() {
    if (!canSubmit) return;
    setModalOpen(true);
  }

  function handleInvested() {
    loadBalance();
    setAmount("");
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-ink-muted">Available cash</h3>
        {balanceState.status === "loading" ? (
          <PortfolioSkeleton className="mt-2 h-7 w-32 rounded-card" label="Loading available cash" />
        ) : balanceState.status === "error" ? (
          <PortfolioErrorState message="We couldn't load your available cash." onRetry={loadBalance} />
        ) : (
          <p className="mt-2 text-xl font-bold text-ink">{formatMoney(balanceState.cashBalance)}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="invest-symbol" className="text-sm font-medium text-ink">
            Symbol
          </label>
          <select
            id="invest-symbol"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="rounded-card border border-gray-200 px-3 py-2 text-sm text-ink"
          >
            {INVESTABLE_SYMBOLS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="invest-amount" className="text-sm font-medium text-ink">
            Amount to invest
          </label>
          <input
            id="invest-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100.00"
            className="rounded-card border border-gray-200 px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {exceedsBalance ? (
        <p role="alert" className="text-sm text-red-700">
          The amount entered exceeds your available cash.
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={handleInvestClick}
          disabled={!canSubmit}
          className="rounded-card bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Invest
        </button>
      </div>

      {isModalOpen ? (
        <ConfirmInvestModal
          symbol={symbol}
          amount={amount}
          onClose={() => setModalOpen(false)}
          onInvested={handleInvested}
        />
      ) : null}
    </div>
  );
}
