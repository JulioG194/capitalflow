"use client"; // holds local amount/plan/months form state and recomputes the estimate on every change (spec 005 AC18)

import { useId, useMemo, useState } from "react";
import { PLAN_ANNUAL_RATE_PERCENT, type InvestmentPlan } from "@capitalflow/shared-types";

const PLAN_OPTIONS: InvestmentPlan[] = ["conservador", "moderado", "agresivo"];

const PLAN_LABELS: Record<InvestmentPlan, string> = {
  conservador: "Conservador",
  moderado: "Moderado",
  agresivo: "Agresivo",
};

const MAX_MONTHS = 60;

type CalculatorResult = {
  estimatedReturn: number;
  estimatedTotal: number;
};

/**
 * Pure display formatter for the calculator's own locally-computed numbers
 * (never a DB/API monetary string — spec 005 section 4 explicitly exempts
 * this illustrative-only computation from the shared `formatMoney`/Decimal
 * rule, so plain JS number arithmetic above is fine). Mirrors `formatMoney`'s
 * manual `$X,XXX.XX` grouping (rather than `Intl.NumberFormat`/
 * `toLocaleString`) so the output is deterministic across Node/browser ICU
 * versions and avoids raw floating-point display artifacts.
 */
function formatEstimate(value: number): string {
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [wholePart, decimalPart] = rounded.toFixed(2).split(".") as [string, string];
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${decimalPart}`;
}

/**
 * Validates the raw inputs and, when valid, computes the pinned formula
 * (spec 005 section 4) entirely client-side:
 *   monthlyRate     = PLAN_ANNUAL_RATE_PERCENT[plan] / 100 / 12
 *   estimatedReturn = amount * ((1 + monthlyRate) ** months - 1)
 *   estimatedTotal  = amount + estimatedReturn
 * Returns a validation message instead of a result whenever the inputs are
 * empty/zero/negative/out-of-range (AC20) — never NaN/Infinity/a fabricated
 * $0.00.
 */
function computeResult(
  amountInput: string,
  plan: InvestmentPlan,
  monthsInput: string,
): { error: string } | { result: CalculatorResult } {
  const amount = Number(amountInput);
  const months = Number(monthsInput);

  if (amountInput.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Ingresa un monto simulado mayor a $0." };
  }
  if (
    monthsInput.trim() === "" ||
    !Number.isInteger(months) ||
    months <= 0 ||
    months > MAX_MONTHS
  ) {
    return { error: `Ingresa un plazo entero entre 1 y ${MAX_MONTHS} meses.` };
  }

  const monthlyRate = PLAN_ANNUAL_RATE_PERCENT[plan] / 100 / 12;
  const estimatedReturn = amount * ((1 + monthlyRate) ** months - 1);
  const estimatedTotal = amount + estimatedReturn;

  return { result: { estimatedReturn, estimatedTotal } };
}

/**
 * AC18-AC22: illustrative rendimiento calculator. Fully decoupled from the
 * real invest flow — this file contains no `fetch`/`apiFetch`/
 * `investInPortfolio` call of any kind (AC21), and nothing computed here is
 * ever sent to the backend or persisted (spec 005 section 4/6).
 */
export function RendimientoCalculator() {
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState<InvestmentPlan>("moderado");
  const [months, setMonths] = useState("12");

  const amountId = useId();
  const planId = useId();
  const monthsId = useId();

  const outcome = useMemo(() => computeResult(amount, plan, months), [amount, plan, months]);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-gray-100 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={amountId} className="text-sm font-medium text-ink">
            Monto simulado
          </label>
          <input
            id={amountId}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1000"
            className="rounded-card border border-gray-200 px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={planId} className="text-sm font-medium text-ink">
            Plan
          </label>
          <select
            id={planId}
            value={plan}
            onChange={(event) => setPlan(event.target.value as InvestmentPlan)}
            className="rounded-card border border-gray-200 px-3 py-2 text-sm text-ink"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {PLAN_LABELS[option]} — {PLAN_ANNUAL_RATE_PERCENT[option]}% anual estimado
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={monthsId} className="text-sm font-medium text-ink">
            Plazo (meses)
          </label>
          <input
            id={monthsId}
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_MONTHS}
            step="1"
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            className="rounded-card border border-gray-200 px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {"error" in outcome ? (
        <p role="alert" className="text-sm text-red-700">
          {outcome.error}
        </p>
      ) : (
        <div className="flex flex-col gap-1 rounded-card bg-gray-50 p-4">
          <p className="text-sm text-ink-muted">Rendimiento estimado</p>
          <p className="text-xl font-bold text-ink">{formatEstimate(outcome.result.estimatedReturn)}</p>
          <p className="text-sm text-ink-muted">
            Total estimado: <span className="font-medium text-ink">{formatEstimate(outcome.result.estimatedTotal)}</span>
          </p>
          <p className="text-xs font-medium text-amber-700">
            Estimación ilustrativa, no garantizada. No representa una promesa de ganancia.
          </p>
        </div>
      )}
    </div>
  );
}
