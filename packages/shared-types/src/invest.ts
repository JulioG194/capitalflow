import { z } from 'zod';
import { MARKET_SYMBOL_GROUPS } from './market';

/**
 * The full set of symbols this spec allows investing in — the same symbols
 * apps/market-stream actually caches prices for (spec 003), so AC2's
 * server-side check and AC23's UI selector share one source of truth
 * rather than two independently maintained lists.
 */
export const INVESTABLE_SYMBOLS: readonly string[] = [
  ...new Set([
    ...MARKET_SYMBOL_GROUPS.ticker,
    ...MARKET_SYMBOL_GROUPS.indices.map((i) => i.symbol),
    ...MARKET_SYMBOL_GROUPS.featured,
  ]),
];

/**
 * Format check only: a positive decimal string with at most 2 decimal
 * places. Business-rule minimums (AC4) and balance sufficiency (AC5) are
 * enforced server-side using Prisma.Decimal arithmetic — never by coercing
 * this string to a JS number — per CLAUDE.md's money rule.
 */
export const investAmountSchema = z
  .string()
  .regex(
    /^(?!0(\.0{1,2})?$)\d+(\.\d{1,2})?$/,
    'Amount must be a positive decimal with up to 2 decimal places',
  );

/**
 * Format check only for `symbol`: a non-empty string. Membership in
 * `INVESTABLE_SYMBOLS` (AC2) is deliberately NOT enforced here via
 * `z.enum(...)` — doing so would make an unsupported symbol fail this
 * schema the same generic way a malformed `amount` does (AC3), collapsing
 * AC2's own distinct `400 UNSUPPORTED_SYMBOL` domain error into an
 * indistinguishable zod validation-error shape before
 * `PortfolioService.invest` ever runs. `INVESTABLE_SYMBOLS` remains
 * exported for the frontend selector (AC23) and is enforced server-side by
 * the service itself (`UnsupportedInvestSymbolException`).
 */
export const investSchema = z.object({
  symbol: z.string().min(1),
  amount: investAmountSchema,
});
export type InvestInput = z.infer<typeof investSchema>;

// Illustrative-only plan rates for the rendimiento calculator (AC18, AC22).
// Never used by POST /portfolio/invest — the calculator is fully decoupled
// from the real invest flow (AC21).
export type InvestmentPlan = 'conservador' | 'moderado' | 'agresivo';

export const PLAN_ANNUAL_RATE_PERCENT: Record<InvestmentPlan, number> = {
  conservador: 4,
  moderado: 7,
  agresivo: 11,
};
