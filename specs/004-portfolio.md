# Spec 004: Simulated Portfolio (`/app/portfolio`)

**Status**: draft
**Author**: Julio
**Created**: 2026-09-15
**Related specs**: 002-auth-users (portfolio is created during registration; the
access token exists only in-memory in the browser per AC41, which shapes this
spec's client-fetch architecture), 003-market-realtime (holdings valuation
reuses the Redis price cache and symbol groups defined there)

## 1. Context & Motivation

Every registered user needs a simulated portfolio to practice with before any
buy/sell ("invest") logic exists. This spec covers the read-only view of that
portfolio: the data model that holds simulated cash, holdings, and
transaction history; the one-time $10,000 simulated cash grant on
registration; and the `/app/portfolio` page that displays balance, profit,
ROI, allocation by asset class, active holdings, and transaction history. It
does **not** cover placing simulated trades — that is a future "invest" spec,
which will be the first feature to actually write `Holding` rows and
`buy`/`sell` `Transaction` rows.

## 2. User Stories

- As a new user, I want to receive simulated starting capital automatically
  when I register, so I can start practicing immediately.
- As a user, I want to see my total simulated balance, profit, and ROI at a
  glance so I can track how my simulated decisions are performing.
- As a user, I want to see how my simulated money is allocated across asset
  classes so I can understand my exposure.
- As a user, I want to see each of my current holdings with its cost basis
  and current value.
- As a user, I want to see a history of every transaction on my account.
- As a user, I want it to be obvious this is simulated money, not a real
  brokerage statement.

## 3. Acceptance Criteria

### Portfolio creation on registration
- [ ] **AC1**: Given a `POST /auth/register` request succeeds (spec 002 AC1), when the user record is created, then a `Portfolio` row is created for that user in the **same database transaction**, with `cashBalance = "10000.00"`.
- [ ] **AC2**: Given the `Portfolio` created in AC1, when its transactions are inspected, then exactly one `Transaction` row exists for it with `type = "deposit"`, `amount = "10000.00"`, `status = "completed"`, `symbol = null`, `quantity = null`, `price = null`.
- [ ] **AC3**: Given portfolio or initial-deposit-transaction creation fails for any reason during registration, when the failure occurs, then the entire registration transaction rolls back (no `User`, `Portfolio`, or `Transaction` row persists) and the API responds `500` with a generic error, never a raw Prisma error (consistent with spec 002 AC32).

### `GET /portfolio` — summary & valuation
- [ ] **AC4**: Given an authenticated user whose portfolio has zero holdings, when `GET /portfolio` is called, then the response is `200` with `cashBalance = holdingsValue-complement` such that `totalBalance = cashBalance`, `totalProfit = "0.00"`, `roiPercent = "0.00"`, and `allocation = [{ assetClass: "cash", value: cashBalance, percentage: "100.00" }]`.
- [ ] **AC5**: Given an authenticated user's portfolio has one or more holdings, when `GET /portfolio` is called, then `holdingsValue` equals the sum of each holding's `quantity * currentPrice` (current price sourced per the pricing rule in section 4), and `totalBalance = cashBalance + holdingsValue`.
- [ ] **AC6**: Given a portfolio's holdings span more than one asset class, when `allocation` is computed, then it contains exactly one slice per distinct asset class present (including `"cash"` whenever `cashBalance > "0.00"`), each slice's `value` is the sum of market values in that class, and each `percentage` is `value / totalBalance * 100` rounded to 2 decimals, with the rounding remainder (`100.00` minus the sum of independently-rounded percentages) added to the slice with the largest `value` so all percentages always sum to exactly `100.00`.
- [ ] **AC7**: Given `totalBalance` is `"0.00"` (defensive edge case; not reachable via any endpoint in this spec's scope), when `allocation` is computed, then it returns `[{ assetClass: "cash", value: "0.00", percentage: "0.00" }]` rather than dividing by zero or raising an error.
- [ ] **AC8**: Given `totalDeposited > "0.00"`, when `roiPercent` is computed as `totalProfit / totalDeposited * 100` rounded to 2 decimals, then it is formatted with a leading `-` for negative values and no leading sign for zero or positive values (e.g. `"-3.42"`, `"0.00"`, `"3.42"`).
- [ ] **AC9**: Given any successful `GET /portfolio` response, when inspected, then it includes an `asOf` field: an ISO-8601 timestamp of when the server computed that valuation snapshot.
- [ ] **AC10**: Given an authenticated user with no `Portfolio` row (data-integrity edge case — should not occur for any account created after AC1 ships), when `GET /portfolio`, `GET /portfolio/holdings`, or `GET /portfolio/transactions` is called, then the API responds `404` with domain error code `PORTFOLIO_NOT_FOUND`.
- [ ] **AC11**: Given a request to any of the three endpoints in this spec without a valid access token, when processed, then the API responds `401 Unauthorized`, consistent with spec 002's `AccessTokenGuard`.

### `GET /portfolio/holdings`
- [ ] **AC12**: Given a portfolio with N holdings, when `GET /portfolio/holdings` is called, then the response is `200` with a bare JSON array of N `HoldingDto` items sorted by `marketValue` descending; given a portfolio with zero holdings, the response is `200` with an empty array (not `404`).
- [ ] **AC13**: Given a held symbol has a non-expired cached price at the pinned Redis key (section 4) at read time, when its `HoldingDto` is built, then `currentPrice` equals that cached price and `isPriceStale = false`.
- [ ] **AC14**: Given a held symbol has no cached price at read time (cache miss, expired TTL, or Redis unreachable), when its `HoldingDto` is built, then `currentPrice` equals `averagePrice` and `isPriceStale = true`.
- [ ] **AC15**: Given a held symbol is not present in the pinned `SYMBOL_ASSET_CLASS` map (section 4), when its `HoldingDto` is built, then `assetClass = "other"` rather than throwing an error.

### `GET /portfolio/transactions`
- [ ] **AC16**: Given a portfolio with transactions and no query params supplied, when `GET /portfolio/transactions` is called, then the response is `200` with `page = 1`, `limit = 20` (defaults), items sorted by `createdAt` descending (ties broken by `id` descending), and `total`/`totalPages` reflecting the full row count.
- [ ] **AC17**: Given `?page=2&limit=5` on a portfolio with more than 5 transactions, when called, then the response returns exactly the second slice of 5 items in the sort order from AC16.
- [ ] **AC18**: Given a `limit` query param greater than 100, when called, then the API clamps it to 100 rather than rejecting the request.
- [ ] **AC19**: Given a `page` or `limit` query param that is non-numeric or less than 1, when called, then the API responds `400 Bad Request` with a field-level validation error (this is distinct from AC18: exceeding the max is clamped as a valid business case, but a structurally invalid value is rejected).
- [ ] **AC20**: Given a portfolio with zero transactions, when `GET /portfolio/transactions` is called, then the response is `200` with `items = []`, `total = 0`, `totalPages = 0`.
- [ ] **AC21**: Given a `page` value beyond the last available page (e.g. `page=999` when only 1 page exists), when called, then the response is `200` with `items = []` and the correct `total`/`totalPages`, not `404`.

### Frontend `/app/portfolio`
- [ ] **AC22**: Given an authenticated user navigates to `/app/portfolio`, when the page's static shell renders, then a Server Component renders headings, section containers, and the platform-wide "Modo Simulador" badge plus a visible note that all figures are simulated, without embedding any live financial value.
- [ ] **AC22a**: Given the shell in AC22, when its data sections are inspected, then each one (summary, allocation chart, holdings table, transaction history) is a separate `"use client"` component responsible for fetching its own data, and each carries a one-line comment explaining why (required because the access token exists only in-memory in the browser per spec 002 AC41, so a Server Component cannot attach it), per CLAUDE.md's `"use client"` convention.
- [ ] **AC23**: Given a data-fetching client component has not yet received a response, when rendered, then it shows an explicit loading/skeleton state, never a blank section or a fabricated `$0.00`/`0%` presented as real data.
- [ ] **AC24**: Given a data-fetching client component's request fails (network error or non-2xx response), when the failure is handled, then it shows a visible error state with a retry action, not a silently blank section.
- [ ] **AC25**: Given the summary section has data, when rendered, then it displays `cashBalance`, `totalBalance`, and `totalProfit` each formatted through the shared `formatMoney` utility, and `roiPercent` formatted as a percentage string (not through `formatMoney`); `totalProfit` and `roiPercent` are visually distinguished as gain vs. loss based on their sign (e.g. color).
- [ ] **AC26**: Given the allocation section has data, when rendered, then it displays a pie chart with exactly one segment per `allocation` slice, each labeled with its asset class and percentage.
- [ ] **AC27**: Given the holdings table has data, when rendered, then it displays one row per holding with `symbol`, `quantity`, `averagePrice`, `currentPrice`, `marketValue`, and `unrealizedProfit` — all monetary fields formatted via `formatMoney` — and rows where `isPriceStale = true` show a visible "price may be outdated" indicator.
- [ ] **AC28**: Given the transaction history table has data, when rendered, then it displays one row per transaction (`type`, `symbol` or `"—"` when `null`, `quantity` or `"—"` when `null`, `amount` formatted via `formatMoney`, `status`, and `createdAt` formatted as a readable date/time), plus pagination controls reflecting `page`/`totalPages`.
- [ ] **AC29**: Given the transaction history's pagination controls, when a user advances to the next page, then the component re-fetches `GET /portfolio/transactions` with the incremented `page` param and replaces the displayed rows.
- [ ] **AC30**: Given any component under `/app/portfolio`, when its source is inspected, then every monetary value is rendered exclusively through `formatMoney` — no raw string interpolation of a Decimal-string field, and no `parseFloat`/`Number()` conversion of a monetary string anywhere in the component.
- [ ] **AC31**: Given an unauthenticated visitor requests `/app/portfolio`, when Next.js middleware processes the request, then it redirects to `/login` using spec 002 AC39's existing session-hint-cookie check (no new middleware logic is introduced by this spec).

### `formatMoney` utility (`@capitalflow/shared-types`)
- [ ] **AC32**: Given `formatMoney("10000")` or `formatMoney("10000.00")`, when called, then it returns `"$10,000.00"`.
- [ ] **AC33**: Given `formatMoney("-42.1")`, when called, then it returns `"-$42.10"` (sign before the currency symbol, always exactly 2 decimal places).
- [ ] **AC34**: Given `formatMoney("0")` or `formatMoney("0.00")`, when called, then it returns `"$0.00"`.
- [ ] **AC35**: Given `formatMoney("1234.567")` (more than 2 decimal places), when called, then it rounds half-up to 2 decimals for display only and returns `"$1,234.57"`.
- [ ] **AC36**: Given `formatMoney` is called with a malformed or non-numeric string (e.g. `""`, `"abc"`, `"NaN"`, `undefined` coerced to a string), when called, then it returns `"$0.00"` rather than throwing, so a single unexpected value cannot crash a page render.

## 4. Technical Contracts

### Design decisions (pinned for this spec)

These four points were left open by the feature description and are resolved
here explicitly rather than left ambiguous:

1. **Asset-class derivation**: no new `assetClass` column is added to
   `Holding`. Instead, `packages/shared-types` exports a static
   `SYMBOL_ASSET_CLASS` map keyed by the exact symbols already pinned in spec
   003's `MARKET_SYMBOL_GROUPS`. A symbol not present in the map resolves to
   `"other"` (AC15) rather than erroring, so the API never breaks if a future
   spec introduces a symbol before this map is updated. Uninvested cash is
   its own asset class, `"cash"`.
2. **Holdings valuation source**: `apps/api` does **not** call Finnhub and
   does not hold a Finnhub key (preserving CLAUDE.md's constraint that only
   `apps/market-stream` talks to Finnhub). It reads the same Redis instance
   `apps/market-stream` caches prices in (spec 003 AC8) at a pinned key
   format (below). If no fresh cached price exists for a held symbol —
   including because nobody currently has `/app/market` open watching it,
   since spec 003's caching is demand-driven (spec 003 AC2–AC7) — `apps/api`
   falls back to the holding's `averagePrice` and flags `isPriceStale: true`
   (AC13/AC14). Proactively warming the cache for every held symbol
   regardless of `/app/market` viewership is explicitly out of scope
   (section 6).
3. **Pagination defaults**: `page` defaults to `1`, `limit` defaults to `20`,
   max `limit` is `100`. Values exceeding the max are silently clamped
   (AC18); structurally invalid values (non-numeric, `< 1`) are rejected with
   `400` (AC19).
4. **ROI / profit formula**: `totalDeposited` = sum of `amount` across all
   `type = "deposit"` transactions for the portfolio (in this spec's scope,
   always exactly the one `$10,000.00` registration grant, but the formula
   generalizes if a future spec adds further deposits). `totalProfit =
   totalBalance - totalDeposited`. `roiPercent = totalProfit / totalDeposited
   * 100`. This is portfolio-level ROI relative to capital ever deposited,
   not per-holding realized/unrealized gain accounting (per-holding
   unrealized profit is reported separately on each `HoldingDto`, per AC27).

### API endpoints (`apps/api`, `src/modules/portfolio/`)

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | /portfolio | Bearer access token | — | `200 PortfolioSummaryDto` |
| GET | /portfolio/holdings | Bearer access token | — | `200 HoldingDto[]` |
| GET | /portfolio/transactions | Bearer access token | `?page=&limit=` (both optional) | `200 PaginatedTransactionsDto` |

All three respond `401` per AC11 and `404 PORTFOLIO_NOT_FOUND` per AC10 when
applicable.

### Pricing source contract (Redis)

`apps/api` reads (never writes) the Redis key `market:quote:<symbol>`, whose
value is a JSON string of at least `{ price: string; timestamp: string }`.
This exact key format is **pinned by this spec** since spec 003 left it
unspecified; when `apps/market-stream`'s caching (spec 003 AC8) is built or
if it already uses a different key, either that implementation or spec 003
must be updated to match this contract, per CLAUDE.md's living-spec rule. A
missing key, an expired key, or a Redis connection failure are all treated
identically by `apps/api`: fall back to `averagePrice`, set
`isPriceStale: true`, and do not fail the request.

### Shared types (`packages/shared-types/src/portfolio.ts`)

```ts
import { z } from "zod";

export type AssetClass = "equity" | "etf" | "crypto" | "cash" | "other";

// Maps every symbol in spec 003's MARKET_SYMBOL_GROUPS to an asset class.
// A symbol absent from this map resolves to "other" at read time (AC15),
// never throws.
export const SYMBOL_ASSET_CLASS: Record<string, Exclude<AssetClass, "cash" | "other">> = {
  AAPL: "equity",
  MSFT: "equity",
  GOOGL: "equity",
  AMZN: "equity",
  TSLA: "equity",
  NVDA: "equity",
  SPY: "etf",
  QQQ: "etf",
  DIA: "etf",
  "BINANCE:BTCUSDT": "crypto",
};

export type TransactionType = "buy" | "sell" | "deposit";
export type TransactionStatus = "pending" | "completed" | "failed";

export interface AllocationSliceDto {
  assetClass: AssetClass;
  value: string;
  percentage: string; // 2 decimals, e.g. "42.50"
}

export interface PortfolioSummaryDto {
  cashBalance: string;
  holdingsValue: string;
  totalBalance: string;
  totalDeposited: string;
  totalProfit: string;
  roiPercent: string; // "-3.42" | "0.00" | "3.42"
  allocation: AllocationSliceDto[];
  asOf: string; // ISO 8601
}

export interface HoldingDto {
  symbol: string;
  assetClass: AssetClass;
  quantity: string;
  averagePrice: string;
  currentPrice: string;
  isPriceStale: boolean;
  marketValue: string;
  unrealizedProfit: string;
  unrealizedProfitPercent: string; // 2 decimals, signed like roiPercent
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  symbol: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  status: TransactionStatus;
  createdAt: string; // ISO 8601
}

export interface PaginatedTransactionsDto {
  items: TransactionDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(20),
});
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
```

### `formatMoney` (`packages/shared-types/src/money.ts`)

```ts
/**
 * Formats a Decimal-string monetary value for display as USD, e.g.
 *   formatMoney("10000")      -> "$10,000.00"
 *   formatMoney("-42.1")      -> "-$42.10"
 *   formatMoney("0")          -> "$0.00"
 *   formatMoney("1234.567")   -> "$1,234.57" (rounded half-up, display only)
 *   formatMoney("abc")        -> "$0.00" (malformed input falls back, never throws)
 *
 * Deliberately does NOT use Intl.NumberFormat: locale-dependent currency
 * glyph/placement is not guaranteed stable across Node/browser versions,
 * which would make output non-deterministic and untestable. Any numeric
 * conversion inside this function exists solely to produce the final
 * rounded-to-2-decimals display string — never for further computation —
 * and is the one sanctioned exception to CLAUDE.md's "never JS number for
 * money" rule. Every other layer (DB, API responses, component props,
 * arithmetic) continues to use Decimal/string only.
 */
export function formatMoney(value: string): string;
```

### Database changes

New Prisma models (migration name: `add_portfolio_holdings_transactions`):

- **Portfolio**: `id` (uuid, PK), `userId` (FK → `User`, **unique** — one
  portfolio per user in this spec; multi-portfolio support is out of scope),
  `cashBalance` (`Decimal(14,2)`, default `10000.00`), `createdAt`.
- **Holding**: `id` (uuid, PK), `portfolioId` (FK → `Portfolio`), `symbol`
  (string), `quantity` (`Decimal(18,6)` — supports fractional shares),
  `averagePrice` (`Decimal(14,2)`), `createdAt`, `updatedAt`. Unique
  constraint on (`portfolioId`, `symbol`) — pinned now even though no write
  path exists yet in this spec, so the future "invest" spec's writes are
  correct by construction.
- **Transaction**: `id` (uuid, PK), `portfolioId` (FK → `Portfolio`), `type`
  (enum `TransactionType`: `buy`|`sell`|`deposit`), `symbol` (string,
  nullable — `null` for `deposit`), `quantity` (`Decimal(18,6)`, nullable),
  `price` (`Decimal(14,2)`, nullable), `amount` (`Decimal(14,2)`), `status`
  (enum `TransactionStatus`: `pending`|`completed`|`failed`), `createdAt`.

### Frontend routes / components (`apps/web/src/app`)

- `(app)/app/portfolio/page.tsx` → `/app/portfolio` — Server Component shell (AC22).
- `<PortfolioSummary />` — `"use client"` (fetches `GET /portfolio` using the in-memory access token from spec 002's `<AuthProvider>`) — balance/profit/ROI cards (AC25).
- `<PortfolioAllocationChart />` — `"use client"` (fetches `GET /portfolio`, renders the `allocation` slice as a pie chart) — (AC26).
- `<HoldingsTable />` — `"use client"` (fetches `GET /portfolio/holdings`) — active investments table (AC27).
- `<TransactionHistory />` — `"use client"` (fetches `GET /portfolio/transactions`, holds pagination state) — transaction history table (AC28, AC29).
- Reuses the platform's persistent "Modo Simulador" badge component (per CLAUDE.md) in the Server Component shell.

## 5. Edge Cases & Errors

- **User has no `Portfolio` row** (data-integrity issue, e.g. pre-dates AC1 or a failed migration backfill): all three endpoints respond `404 PORTFOLIO_NOT_FOUND` (AC10) rather than a `500` or an empty/zeroed response.
- **Held symbol not in `SYMBOL_ASSET_CLASS`**: resolves to `"other"` (AC15), never throws.
- **Redis cache miss because nobody is currently watching that symbol on `/app/market`** (a direct consequence of spec 003's demand-driven subscription model, not necessarily staleness in the traditional sense): treated identically to an expired cache entry — fallback to `averagePrice`, `isPriceStale: true` (AC14).
- **Redis unreachable** at read time: every holding falls back to `averagePrice` with `isPriceStale: true`; the endpoint still responds `200` (does not fail the whole request over a cache outage), and the error is logged.
- **`totalBalance = "0.00"`**: allocation defaults to a single `"cash"` slice at `0.00`/`0.00%` rather than dividing by zero (AC7).
- **`totalDeposited = "0.00"`** (should not occur given AC1's guaranteed grant, but guarded defensively): `roiPercent` returns `"0.00"` rather than `NaN`/`Infinity`.
- **`page` beyond the last available page**: `200` with `items: []`, not `404` (AC21).
- **Registration transaction fails partway** (e.g. `Portfolio` insert fails after the `User` insert): entire operation rolls back; no `User` row persists either (AC3).
- **Two concurrent `GET` requests for the same portfolio**: no special handling required — these endpoints are read-only in this spec, so there is no write race to resolve.
- **A future "invest" spec's write logic and this spec's read model disagree** (e.g. on the unique holding-per-symbol constraint): that spec must reconcile with the `Holding` unique constraint pinned in section 4 or update this spec in the same commit, per CLAUDE.md's living-spec rule.

## 6. Out of Scope

- Placing simulated trades (buy/sell) or any endpoint that writes `Holding` or `buy`/`sell` `Transaction` rows — a future "invest" spec. This spec's endpoints are read-only.
- Additional cash deposits beyond the one-time $10,000 registration grant (e.g. a user-initiated "add funds" flow).
- Live/real-time socket-driven updates to `/app/portfolio` — this spec's page is a snapshot fetched on load, with pagination triggering explicit re-fetches; no polling or Socket.io connection is opened by this page.
- Realized gain/loss tracking distinct from unrealized gain/loss — no `sell` transactions are possible without the future invest spec, so realized P&L has nothing to compute yet.
- Multi-currency portfolios — USD only.
- CSV/PDF export of transaction history.
- Historical portfolio-value charts (equity curve over time) — only the current-moment allocation pie chart and summary figures are in scope.
- Tax-lot accounting methods (FIFO/LIFO/specific-lot) beyond the single `averagePrice` field on `Holding`.
- Proactively subscribing `apps/market-stream` to every symbol held by any user's portfolio regardless of `/app/market` viewership (see Edge Cases) — this spec only does a best-effort read of whatever is already cached.
- Multiple portfolios per user.
- Admin/ops visibility into other users' portfolios.
- Notifications or alerts on portfolio value changes.
- Native/mobile clients — web only.
- Non-`es` locale copy for this page (per spec 001's precedent).
- Negative/overdrawn cash balances — not reachable in this spec since no spend path exists yet (all endpoints are read-only), but the future "invest"/buy-sell spec must explicitly define whether a buy can ever push `cashBalance` below `"0.00"` and, if not, how it's rejected.

## 7. Implementation Notes

- Portfolio creation must be added to spec 002's `AuthService.register` flow (or an equivalent hook invoked from within the same Prisma transaction) — not a separate post-registration step that could leave a `User` without a `Portfolio` if it fails.
- All monetary arithmetic (sums, percentages, ROI) happens server-side using Prisma's `Decimal` type (or an equivalent arbitrary-precision library) — never native JS floating-point math — before being serialized to strings in the response.
- The rounding-remainder rule in AC6 (assign the leftover to the largest slice) needs a concrete, deterministic tie-break if two slices are exactly equal in value; implementer should pick a stable order (e.g. first by insertion order of `SYMBOL_ASSET_CLASS`/`"cash"`) and document it in code.
- `formatMoney`'s internal numeric conversion is bounded by the simulator's realistic value range; portfolio balances are not expected to approach `Number.MAX_SAFE_INTEGER`, so precision loss from that one display-only conversion is not a practical concern here.

## 8. Validation Plan

### Automated
- **Unit tests (Jest, `apps/api`)**: `totalBalance`/`totalProfit`/`roiPercent` computation (including zero-balance and zero-deposit guards), allocation percentage rounding-remainder rule, `isPriceStale` fallback logic (cache hit / miss / Redis-down), `assetClass` fallback to `"other"`, pagination default/clamp/reject behavior.
- **Integration tests (Jest + test DB, `apps/api`)**: registration creates `Portfolio` + initial `deposit` `Transaction` atomically (and rolls back together on induced failure); `GET /portfolio`, `/holdings`, `/transactions` success and `404`/`401` paths; transactions pagination against a seeded multi-page dataset.
- **Unit tests (Vitest, `packages/shared-types`)**: `formatMoney` against the exact input/output pairs in AC32–AC35, plus additional grouping cases (e.g. `"1234567.5"` → `"$1,234,567.50"`).
- **Unit tests (Vitest, `apps/web`)**: each data-fetching component's loading/error/populated states; a static-analysis or grep-based test asserting no `parseFloat`/`Number(` appears in any `apps/web/src/components/portfolio/**` file touching a monetary field (supports AC30).
- **E2E (Playwright)**: register a new user → navigate to `/app/portfolio` → see the $10,000 baseline summary, a single "cash" allocation slice, an empty holdings table, and one `deposit` transaction in history; unauthenticated visit redirects to `/login`.

### Manual
- Seed a test portfolio with holdings across multiple asset classes and confirm the pie chart segments and percentages sum to 100% visually.
- Stop the local Redis container and confirm `/app/portfolio` still renders holdings (using `averagePrice`) with the "price may be outdated" indicator, rather than erroring.
- Confirm `formatMoney` output visually in the browser matches the pinned examples for a large value, a negative value, and zero.
