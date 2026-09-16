# Spec 005: Simulated Invest Flow (`/app/invest`)

**Status**: implemented
**Author**: Julio
**Created**: 2026-09-15
**Related specs**: 002-auth-users (access token guard reused on the new endpoint;
in-memory-only token storage shapes the client-fetch architecture), 003-market-realtime
(the supported investable symbol set and the Redis price-cache contract this
spec depends on), 004-portfolio (`PortfolioSummaryDto`, the `Holding`/`Transaction`
Prisma models, `formatMoney`, and the "Simulator mode" badge are all reused
here rather than reinvented — this spec is the first to actually write
`Holding` rows and `buy` `Transaction` rows, which spec 004 explicitly left
for "a future invest spec")

## 1. Context & Motivation

Spec 004 built a read-only portfolio view seeded with a one-time simulated
cash grant, but no path exists yet for a user to actually put that simulated
cash "to work." This spec adds the `/app/invest` page — an illustrative
rendimiento (return) calculator for exploration, plus the first write path
that lets a user commit simulated cash to a symbol, deduct their simulated
balance, and create the corresponding `Holding`/`Transaction` rows. No real
money, payment gateway, or brokerage connection is involved anywhere in this
flow.

## 2. User Stories

- As a user, I want to explore how different simulated amounts, plans, and
  time horizons might play out, without it being a real projection or promise.
- As a user, I want to commit some of my simulated cash to a specific symbol
  so I can practice making an investment decision.
- As a user, I want to see exactly what I'm about to do before it's final, so
  I don't commit simulated funds by accident.
- As a user, I want my portfolio view to reflect a new investment immediately
  after I confirm it, without reloading the page.
- As a user, I want it obvious at every step that this is simulated investing
  with no real money and no guaranteed return.

## 3. Acceptance Criteria

### Backend — `POST /portfolio/invest`

- [x] **AC1**: Given an authenticated user submits `POST /portfolio/invest` with a `symbol` present in the supported investable symbol set (the union of spec 003's `MARKET_SYMBOL_GROUPS.ticker`, `.indices[].symbol`, and `.featured`) and a well-formed positive `amount` (decimal string, at most 2 decimal places, at least `"1.00"`), when the request is processed and a fresh, non-expired cached price exists at Redis key `market:quote:<symbol>` (spec 004's pinned pricing contract), then the API responds `201` with the caller's updated `PortfolioSummaryDto`.
- [x] **AC2**: Given a `symbol` not present in the supported investable symbol set, when `POST /portfolio/invest` is called, then the API responds `400 Bad Request` with domain error code `UNSUPPORTED_SYMBOL`, and no `Transaction` or `Holding` row is created or modified.
- [x] **AC3**: Given an `amount` that is zero, negative, non-numeric, or has more than 2 decimal places, when `POST /portfolio/invest` is called, then the request is rejected `400 Bad Request` with field-level validation errors by the shared zod schema before any business logic runs.
- [x] **AC4**: Given a structurally well-formed `amount` below `"1.00"` (e.g. `"0.50"`), when `POST /portfolio/invest` is called, then the API responds `400 Bad Request` with domain error code `AMOUNT_BELOW_MINIMUM`.
- [x] **AC5**: Given the caller's `Portfolio.cashBalance` is strictly less than `amount`, when `POST /portfolio/invest` is called, then the API responds `422 Unprocessable Entity` with domain error code `INSUFFICIENT_FUNDS`, `cashBalance` is left unchanged, and no `Transaction` or `Holding` row is created or modified.
- [x] **AC6**: Given two concurrent `POST /portfolio/invest` requests from the same user, each with an `amount` that individually fits the current balance but whose sum exceeds it, when both are processed, then exactly one succeeds (deducting its `amount` and persisting its `Transaction`/`Holding` changes) and the other fails with the `422 INSUFFICIENT_FUNDS` response from AC5 — the balance check and deduction happen as a single atomic conditional database operation, never as a separate read followed by a write.
- [x] **AC7**: Given no fresh cached price exists at `market:quote:<symbol>` (missing key, expired TTL, or Redis unreachable) at the moment the request is processed, when handled, then the API responds `503 Service Unavailable` with domain error code `PRICE_UNAVAILABLE`, and no `cashBalance` deduction, `Transaction`, or `Holding` change occurs — this endpoint never falls back to a holding's `averagePrice` or any other synthesized price the way spec 004's read-only valuation does, since doing so here would fabricate the price at which a purchase actually executed.
- [x] **AC8**: Given a successful invest (AC1) for a `symbol` the user does not currently hold, when persisted, then exactly one new `Holding` row is created with `quantity = amount / purchasePrice` (rounded half-up to 6 decimal places) and `averagePrice = purchasePrice` (rounded to 2 decimal places).
- [x] **AC9**: Given a successful invest (AC1) for a `symbol` the user already holds, when persisted, then the existing `Holding` row is updated in place (never a second row for the same `portfolioId` + `symbol`, consistent with spec 004's unique constraint) with `quantity` incremented by the newly purchased quantity and `averagePrice` recomputed as the quantity-weighted average of the prior holding and this purchase, rounded to 2 decimal places.
- [x] **AC10**: Given a successful invest (AC1), when persisted, then exactly one new `Transaction` row is created with `type = "buy"`, `symbol` equal to the request's `symbol`, `quantity` equal to the purchased quantity from AC8/AC9, `price` equal to `purchasePrice`, `amount` equal to the request's `amount`, and `status = "completed"`.
- [x] **AC11**: Given a successful invest (AC1), when persisted, then `Portfolio.cashBalance` is decremented by exactly `amount`, computed with `Decimal` arithmetic and never a JS `number` conversion.
- [x] **AC12**: Given an authenticated user with no `Portfolio` row (data-integrity edge case per spec 004 AC10), when `POST /portfolio/invest` is called, then the API responds `404` with domain error code `PORTFOLIO_NOT_FOUND`.
- [x] **AC13**: Given a request to `POST /portfolio/invest` without a valid access token, when processed, then the API responds `401 Unauthorized`.
- [x] **AC14**: Given a user has made 30 authenticated `POST /portfolio/invest` requests (successful or failed) within a rolling 60-minute window, when a 31st request is made within that window, then the API responds `429 Too Many Requests` with a `Retry-After` header, and no invest logic (balance check, price lookup, persistence) runs for that request.
- [x] **AC15**: Given the rate-limit window in AC14 has elapsed since the last throttled response, when a subsequent invest request is made by that user, then the API processes it normally.
- [x] **AC16**: Given any error response from `POST /portfolio/invest`, when the response body is inspected, then it never contains a raw Prisma error message, stack trace, or SQL detail — every failure is mapped to a domain exception first, consistent with CLAUDE.md's error-handling convention.
- [x] **AC17**: Given any response (success or error) from `POST /portfolio/invest`, when the body is inspected, then every monetary or quantity field (`amount`, `cashBalance`, `price`, `quantity`, etc.) is a string, never a JS `number`.

### Frontend `/app/invest` — rendimiento calculator

- [x] **AC18**: Given a user on `/app/invest` enters an `amount`, selects a `plan` (`conservador` | `moderado` | `agresivo`), and enters `months` (integer, 1–60) into the calculator, when any of the three inputs changes, then the calculator recomputes and displays `estimatedReturn` and `estimatedTotal` using the pinned formula in section 4, entirely client-side, with no network request issued as a result of the change.
- [x] **AC19**: Given the calculator's displayed result, when rendered, then it is visibly labeled as an illustrative, non-guaranteed estimate (e.g. "Illustrative estimate, not guaranteed") and is never presented as a promised or guaranteed return, consistent with CLAUDE.md's simulator-transparency rule.
- [x] **AC20**: Given the calculator's `amount` is empty, zero, or negative, or `months` is empty, zero, or greater than 60, when computed, then the calculator shows an inline validation message and displays no numeric result (never `NaN`, `Infinity`, or a fabricated `$0.00`).
- [x] **AC21**: Given the calculator component, when its source is inspected, then it contains no call to `POST /portfolio/invest` or any other network request — it is fully decoupled from the confirm-investment flow described below.
- [x] **AC22**: Given the calculator's plan selector, when rendered, then each of the three plans displays its pinned illustrative annual rate (e.g. "Moderado — 7% anual estimado") so the user can see which assumption produced the displayed estimate.

### Frontend `/app/invest` — investment form & confirm modal

- [x] **AC23**: Given an authenticated user on `/app/invest`, when the page's investment form renders, then it presents a `symbol` selector constrained to the same supported investable symbol set as AC2 (an unsupported symbol cannot be selected through the UI) and an `amount` input.
- [x] **AC24**: Given the investment form has fetched the user's current `cashBalance` via `GET /portfolio` on mount, when rendered, then the balance is displayed via `formatMoney`, and the "Invest" button is disabled with a visible message whenever the entered `amount` exceeds the displayed balance — this is a UX guard only; AC5's server-side check remains the sole security boundary.
- [x] **AC25**: Given a valid `symbol` and `amount` are entered and the user clicks "Invest", when the click is handled, then a "Confirm investment" modal opens displaying the selected `symbol`, the `amount` formatted via `formatMoney`, and copy stating the investment is simulated and no real money moves.
- [x] **AC26**: Given the confirm modal is open, when the user clicks "Confirm", then the frontend calls `POST /portfolio/invest` with `{ symbol, amount }`, and the confirm button enters a disabled/loading state for the duration of the request, preventing a duplicate submission from a repeated click.
- [x] **AC27**: Given `POST /portfolio/invest` responds `201`, when handled, then the modal displays a success state (e.g. "Simulated investment placed"), then closes, and the page's displayed portfolio data (cash balance and any on-page summary/holdings elements) updates via a client-side refetch — never via `window.location.reload()` or a full navigation.
- [x] **AC28**: Given `POST /portfolio/invest` responds `422` with `INSUFFICIENT_FUNDS`, when handled, then the modal remains open, displays a message indicating insufficient simulated funds, and does not clear the entered `amount`.
- [x] **AC29**: Given `POST /portfolio/invest` responds `503` with `PRICE_UNAVAILABLE`, when handled, then the modal remains open and displays a retry-oriented error message without discarding the entered `symbol`/`amount`.
- [x] **AC30**: Given `POST /portfolio/invest` responds `429`, when handled, then the modal displays a message indicating too many investment attempts and to wait before retrying, and surfaces (or derives a wait time from) the response's `Retry-After` value.
- [x] **AC31**: Given the confirm modal has an in-flight `POST /portfolio/invest` request, when the user closes the modal or navigates away from `/app/invest` before the response arrives, then the already-sent request is left to complete server-side (it is not cancelled, and the server-side outcome — cash deducted, `Transaction`/`Holding` written or not, per AC1–AC11 — is unaffected by the client no longer being mounted); the frontend does not attempt to update state on the unmounted component (no console error, no orphaned modal); and the next time `/app/portfolio` or `/app/invest` fetches data, the displayed cash balance, holdings, and transaction history reflect that request's actual outcome. Given the user reopens the confirm modal for a new attempt after navigating away mid-request, when the new attempt is submitted, then it is sent as an independent `POST /portfolio/invest` call — the earlier in-flight request is never resubmitted or duplicated.
- [x] **AC32**: Given any component under `/app/invest`, when its source is inspected, then every monetary value is rendered exclusively through `formatMoney`, with no `parseFloat`/`Number()` conversion applied to a monetary string field (mirrors spec 004 AC30).
- [x] **AC33**: Given the `/app/invest` page, when rendered, then it displays the platform-wide "Simulator mode" badge and a visible disclaimer that all investments are simulated and no real money is involved.
- [x] **AC34**: Given an unauthenticated visitor requests `/app/invest`, when Next.js middleware processes the request, then it redirects to `/login`, using spec 002 AC39's existing session-hint-cookie check (no new middleware logic is introduced by this spec).

## 4. Technical Contracts

### Design decisions (pinned for this spec)

1. **No price fallback on purchase** (contrast with spec 004): `GET /portfolio*`
   falls back to `averagePrice` when the Redis cache misses, because that
   endpoint is only *valuing* an already-owned holding. `POST /portfolio/invest`
   is different — it is the moment that determines the actual purchase price,
   so a cache miss must fail the request (AC7, `PRICE_UNAVAILABLE`) rather
   than invent a price. A practical consequence, inherited from spec 003's
   demand-driven subscription model: if nobody currently has `/app/market`
   open watching a symbol, `apps/market-stream` has not cached a price for
   it, and an invest attempt for that symbol will fail until someone does.
   Proactively warming the cache on invest-intent is out of scope (section 6).
2. **Balance check + deduction is one atomic operation.** The implementer
   must not read `cashBalance`, compare it in application code, and then
   issue a separate `UPDATE`. AC6 requires a single conditional update (e.g.
   `UPDATE "Portfolio" SET "cashBalance" = "cashBalance" - $amount WHERE id
   = $id AND "cashBalance" >= $amount`, checking the affected row count) so
   two concurrent requests can never both succeed against the same balance.
   This mirrors the atomic "check-and-mark" pattern spec 002 required for
   refresh-token reuse detection (spec 002 AC16).
3. **Rate limiting is keyed by user, not IP.** Unlike spec 002's login
   throttle (necessarily IP-keyed, since the caller is unauthenticated),
   this endpoint always has an authenticated `req.user.sub` available, and
   IP-keying would incorrectly bucket multiple users behind the same NAT/
   office network together.
4. **Minimum investment amount is pinned at `"1.00"`** (`AMOUNT_BELOW_MINIMUM`,
   AC4). This is a judgment call by this spec, not a value supplied
   elsewhere — flagged for confirmation.
5. **Quantity precision**: purchased `quantity = amount / purchasePrice`,
   rounded half-up to 6 decimal places (matching `Holding.quantity`'s
   `Decimal(18,6)` column from spec 004). The `amount` actually deducted
   from `cashBalance` is always the exact requested value, never recomputed
   from the rounded quantity, so cash accounting never drifts from a
   rounding artifact.

### API endpoints (`apps/api`, `src/modules/portfolio/`)

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | /portfolio/invest | Bearer access token, rate-limited (30/hour/user) | `{ symbol: string; amount: string }` | `201 PortfolioSummaryDto` |

Error responses:

| Status | Code | Condition |
|---|---|---|
| 400 | (zod field errors) | malformed `amount`/`symbol` (AC3) |
| 400 | `UNSUPPORTED_SYMBOL` | symbol not in the investable set (AC2) |
| 400 | `AMOUNT_BELOW_MINIMUM` | `amount < "1.00"` (AC4) |
| 401 | — | missing/invalid access token (AC13) |
| 404 | `PORTFOLIO_NOT_FOUND` | no `Portfolio` row (AC12) |
| 422 | `INSUFFICIENT_FUNDS` | `cashBalance < amount` (AC5, AC6) |
| 429 | — | rate limit exceeded (AC14), `Retry-After` header set |
| 503 | `PRICE_UNAVAILABLE` | no fresh cached price (AC7) |

`PortfolioSummaryDto` is the exact type already defined in
`packages/shared-types/src/portfolio.ts` by spec 004 — this endpoint returns
it unmodified so the frontend can reuse spec 004's existing rendering/format
logic without a divergent shape.

### Shared types (`packages/shared-types/src/invest.ts`)

```ts
import { z } from "zod";
import { MARKET_SYMBOL_GROUPS } from "./market";

// The full set of symbols this spec allows investing in — the same
// symbols apps/market-stream actually caches prices for (spec 003), so
// PortfolioService.invest's server-side membership check (AC2) and
// AC23's UI selector share one source of truth rather than two
// independently maintained lists.
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
 * enforced server-side using Prisma.Decimal arithmetic — never by
 * coercing this string to a JS number — per CLAUDE.md's money rule.
 */
export const investAmountSchema = z
  .string()
  .regex(
    /^(?!0(\.0{1,2})?$)\d+(\.\d{1,2})?$/,
    "Amount must be a positive decimal with up to 2 decimal places",
  );

/**
 * `symbol` is deliberately a format-only check here (any non-empty
 * string), NOT `z.enum(INVESTABLE_SYMBOLS)`. An enum would make an
 * unsupported symbol fail this same shared schema the same generic way a
 * malformed `amount` does (AC3), collapsing AC2's own distinct
 * `400 UNSUPPORTED_SYMBOL` domain error into an indistinguishable zod
 * validation-error shape before `PortfolioService.invest` ever runs.
 * Membership in `INVESTABLE_SYMBOLS` (AC2) is enforced as this method's
 * own first business-rule check instead, mirroring how the minimum-amount
 * check (AC4) is also a service-level check on top of this schema's pure
 * format validation.
 */
export const investSchema = z.object({
  symbol: z.string().min(1),
  amount: investAmountSchema,
});
export type InvestInput = z.infer<typeof investSchema>;

// Illustrative-only plan rates for the rendimiento calculator (AC18, AC22).
// Never used by POST /portfolio/invest — the calculator is fully decoupled
// from the real invest flow (AC21).
export type InvestmentPlan = "conservador" | "moderado" | "agresivo";

export const PLAN_ANNUAL_RATE_PERCENT: Record<InvestmentPlan, number> = {
  conservador: 4,
  moderado: 7,
  agresivo: 11,
};
```

`InvestResponseDto` is `PortfolioSummaryDto` (imported from `./portfolio`,
no new response type needed).

### Rendimiento calculator formula (pinned, client-side only)

```
monthlyRate      = PLAN_ANNUAL_RATE_PERCENT[plan] / 100 / 12
estimatedReturn  = amount * ((1 + monthlyRate) ** months - 1)
estimatedTotal   = amount + estimatedReturn
```

This computation happens entirely in the browser, is never persisted, and is
never sent to the backend (AC21). It is therefore exempt from CLAUDE.md's
"never JS number for money" rule the same way `formatMoney`'s display-only
conversion is exempt (spec 004 section 4) — nothing computed here is DB state
or an API payload. Implementers should still round only the final displayed
figures (not intermediate steps) to avoid gratuitous floating-point display
artifacts.

### Database changes

No new Prisma models or migrations. This spec is the first to write to the
`Holding` and `Transaction` models spec 004 already created
(`add_portfolio_holdings_transactions`), using the exact shapes/constraints
already pinned there: `Holding` unique on (`portfolioId`, `symbol`);
`Transaction.type = "buy"`, `status = "completed"`.

### Backend module structure (`apps/api/src/modules/portfolio/`)

- `portfolio.controller.ts` — add `POST /invest`, guarded by
  `AccessTokenGuard` and a per-user throttle guard.
- `portfolio.service.ts` — add `invest(userId, symbol, amount)`: checks
  `symbol` against `INVESTABLE_SYMBOLS` itself (AC2 — `investSchema`'s
  `symbol` field is a format-only check, not an enum, precisely so this
  membership check is reachable as its own distinct error), looks up
  the fresh price via the existing `RedisService` (same `market:quote:<symbol>`
  key spec 004 already reads), performs the atomic conditional balance
  deduction, and creates the `Transaction` + upserts the `Holding` inside a
  single `prisma.$transaction`, so any failure rolls back every write.
- `src/common/exceptions/`: new `insufficient-funds.exception.ts` (422,
  `INSUFFICIENT_FUNDS`), `unsupported-invest-symbol.exception.ts` (400,
  `UNSUPPORTED_SYMBOL`), `amount-below-minimum.exception.ts` (400,
  `AMOUNT_BELOW_MINIMUM`), `price-unavailable.exception.ts` (503,
  `PRICE_UNAVAILABLE`) — each extends the existing `DomainException` base
  class used by spec 002/004's exceptions.

### Frontend routes / components (`apps/web/src/app`)

- `(app)/app/invest/page.tsx` → `/app/invest` — Server Component shell
  (badge, disclaimer, section containers per AC33).
- `<RendimientoCalculator />` — `"use client"` (holds local form state for
  amount/plan/months and recomputes on every change) — AC18–AC22.
- `<InvestForm />` — `"use client"` (fetches `GET /portfolio` for the current
  balance, holds symbol/amount form state) — AC23–AC24.
- `<ConfirmInvestModal />` — `"use client"` (calls `POST /portfolio/invest`,
  holds request/success/error state) — AC25–AC31.
- Reuses `formatMoney` (spec 004) and the platform's `<SimulatorBadge />`
  (spec 001/CLAUDE.md) rather than reimplementing either.

## 5. Edge Cases & Errors

- **Insufficient funds**: rejected `422 INSUFFICIENT_FUNDS` (AC5); no partial
  state change.
- **Concurrent invest requests racing the same balance**: resolved by the
  atomic conditional update (AC6) — exactly one wins.
- **Redis cache miss/expired/unreachable at invest time**: rejected `503
  PRICE_UNAVAILABLE` (AC7) — unlike spec 004's read-only valuation, this
  endpoint never substitutes `averagePrice` for a real-time purchase price.
- **Nobody is currently watching the symbol on `/app/market`** (a direct
  consequence of spec 003's demand-driven caching): identical to the above —
  the user must open `/app/market` for that symbol first so market-stream
  begins caching it, or the invest attempt fails with `PRICE_UNAVAILABLE`.
- **Rate limit exceeded**: `429` with `Retry-After` (AC14); normal service
  resumes once the window elapses (AC15).
- **Zero/negative/malformed `amount`**: rejected `400` before any business
  logic (AC3).
- **`amount` below the pinned `"1.00"` minimum**: rejected `400
  AMOUNT_BELOW_MINIMUM` (AC4).
- **Unsupported `symbol`**: rejected `400 UNSUPPORTED_SYMBOL` (AC2), no
  upstream or persistence side effect.
- **User has no `Portfolio` row** (data-integrity issue, per spec 004 AC10):
  `404 PORTFOLIO_NOT_FOUND` (AC12).
- **Repeated invest into a symbol already held**: updates the existing
  `Holding` row's `quantity`/`averagePrice` in place (AC9) rather than
  creating a duplicate row, consistent with spec 004's unique constraint.
- **Modal closed or component unmounted while a `POST /portfolio/invest`
  request is still in flight** (e.g. user navigates away): handled by AC31 —
  the in-flight request is allowed to complete server-side (money/holdings
  state is authoritative regardless of UI lifecycle), the frontend must not
  attempt to update state on an unmounted component, the next visit to
  `/app/portfolio` or `/app/invest` reflects the outcome via a fresh fetch,
  and reopening the modal for a new attempt sends an independent request
  rather than resubmitting or duplicating the earlier one.
- **Frontend calculator given an invalid `months`/`amount`**: shows inline
  validation, never `NaN`/`Infinity` (AC20).

## 6. Out of Scope

- Selling or liquidating a holding — a symmetric future "divest" spec.
  Nothing in this spec creates a `sell` `Transaction`.
- Any real payment gateway, card entry, or bank-linking UI — no such
  component exists anywhere in this flow; all funds are simulated and
  already present in `Portfolio.cashBalance` from spec 004's registration
  grant.
- Persisting the calculator's selected `plan`/`months`, or enforcing any
  lock-up/maturity period tied to it — the calculator is a stateless,
  illustrative preview with no link to any actual holding or transaction.
- Recurring or scheduled automatic investments (dollar-cost averaging).
- Limit orders or specifying a desired execution price — every invest
  executes at the prevailing cached market price ("market order" style
  only); no order book or pending-order state exists.
- Reversing, cancelling, or editing a completed `buy` transaction.
- Proactively subscribing `apps/market-stream` to a symbol on invest-intent
  to guarantee a fresh price is available — this spec accepts that an
  invest attempt can fail with `PRICE_UNAVAILABLE` if nobody is currently
  watching that symbol on `/app/market` (see Edge Cases); an on-demand
  cache-warming request is left to a future spec.
- Multi-currency investing — USD only.
- Any change to spec 004's existing read-only endpoints (`GET /portfolio`,
  `/holdings`, `/transactions`) beyond consuming their current response
  shapes as-is.
- Notifications, emails, or receipts for a completed investment.
- Native/mobile clients — web only.
- Non-`en` locale copy for this page (per spec 001's precedent).

## 7. Implementation Notes

- The atomic conditional balance deduction (design decision 2) plus the
  `Transaction` insert plus the `Holding` upsert must all happen inside one
  `prisma.$transaction` so a failure partway (e.g. the `Holding` upsert
  throwing) rolls back the balance deduction too — no path may leave
  `cashBalance` decremented without a corresponding `Transaction`/`Holding`.
- `@nestjs/throttler` (already a project dependency per spec 002) should be
  configured with a custom `getTracker`/storage key derived from
  `req.user.sub` for this route specifically, distinct from spec 002's
  IP-keyed login throttle.
- Weighted-average `averagePrice` recomputation (AC9):
  `newAveragePrice = (existingQuantity * existingAveragePrice + purchasedQuantity * purchasePrice) / (existingQuantity + purchasedQuantity)`,
  rounded to 2 decimal places, using `Prisma.Decimal` throughout.
- The minimum investment amount (`"1.00"`) and the three plan rates
  (4% / 7% / 11%) are judgment calls made by this spec in the absence of a
  supplied value — flagged for confirmation before implementation.

## 8. Validation Plan

### Automated
- **Unit tests (Jest, `apps/api`)**: quantity computation and rounding
  (new holding and weighted-average update paths), the atomic
  conditional-update balance check (including a simulated race via two
  interleaved calls), price-unavailable fallback rejection (cache miss /
  expired / Redis-down all rejected, never falling back to `averagePrice`),
  minimum-amount and unsupported-symbol validation, rate-limiter tracker
  keying by user id.
- **Integration tests (Jest + test DB, `apps/api`)**: full success path
  (`201`, correct `Portfolio`/`Holding`/`Transaction` state); each error path
  (`400` ×3 variants, `401`, `404`, `422`, `429`, `503`) with assertions that
  no partial state was written; a concurrency test firing two simultaneous
  invest requests against a fixed balance and asserting exactly one succeeds.
- **Unit tests (Vitest, `packages/shared-types`)**: `investAmountSchema`
  against valid/invalid decimal strings; the calculator formula against a
  table of pinned amount/plan/months → expected estimate cases.
- **Unit tests (Vitest, `apps/web`)**: `<RendimientoCalculator />`'s
  input-change → recompute behavior and validation states (AC18–AC20); a
  static-analysis/grep-based test asserting no `parseFloat`/`Number(` appears
  in any `apps/web/src/components/invest/**` file touching a monetary field
  (AC32), and no `fetch`/API call originates from the calculator component
  (AC21).
- **E2E (Playwright)**: authenticated visit to `/app/invest` → use the
  calculator (assert no network call fires) → select a symbol and amount →
  open confirm modal → confirm → assert success state, modal closes, and the
  displayed cash balance updates without a page reload; a mocked
  `422`/`503`/`429` response keeps the modal open with the corresponding
  message; unauthenticated visit redirects to `/login`.

### Manual
- Manually drive `cashBalance` to just above an intended invest `amount` and
  confirm a normal purchase succeeds and the balance lands at exactly `0.00`
  when fully invested.
- Stop the local Redis container (or invest in a symbol nobody currently has
  open on `/app/market`) and confirm the invest attempt fails with a visible
  "price unavailable" message rather than silently succeeding at a wrong
  price.
- Fire 31 invest requests within an hour for one test user and confirm the
  31st is rejected with `429` and a sensible `Retry-After`.
