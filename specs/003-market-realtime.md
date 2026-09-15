# Spec 003: Real-Time Market Data Streaming & `/app/market` Page

**Status**: in progress (market-stream backend implemented; remaining frontend ACs for chart/table/banner)
**Author**: Julio
**Created**: 2026-09-15
**Related specs**: 002-auth-users (RS256 access tokens verified here; in-memory-only token storage on the frontend shapes section 4's design)

## 1. Context & Motivation

CapitalFlow needs live-feeling market data so users can practice reading price
movement before making simulated investment decisions. Finnhub's free tier
(60 req/min, single upstream WebSocket, 15-minute delayed quotes) cannot be
called directly by every browser tab — `apps/market-stream` is the single
holder of the Finnhub connection and API key, and must fan quotes out
efficiently to many authenticated Socket.io clients without violating Finnhub's
rate limits or leaking stale/incorrect data. This spec covers the market-stream
service's upstream connection management, caching, resilience, and auth, plus
the `/app/market` page that consumes it. It does not cover portfolios,
transactions, or the "invest" flow (future specs).

## 2. User Stories

- As an authenticated user, I want to see near-live prices for a handful of
  well-known stocks, indices, and BTC/USD so I can practice reading market
  movement without any real money at risk.
- As an authenticated user, I want it to be obvious the data is delayed and
  this is a simulation, not real-time trading infrastructure.
- As an operator, I want exactly one upstream connection to Finnhub regardless
  of how many browser tabs are open, so the free-tier rate limit is never at risk.
- As an operator, I want the service to recover automatically from upstream
  disconnects and to shed load gracefully under backpressure, without crashing
  or silently going stale.

## 3. Acceptance Criteria

### Upstream connection & dynamic subscription (market-stream)
- [x] **AC1**: Given the market-stream service process starts, when it initializes, then it opens exactly one upstream WebSocket connection to Finnhub for the lifetime of the process, regardless of how many Socket.io clients later connect.
- [x] **AC2**: Given a symbol currently has zero clients watching it, when the first client emits `subscribe` for that symbol, then the service sends a Finnhub upstream subscribe message for that symbol.
- [x] **AC3**: Given a symbol currently has at least one client watching it, when a second (or later) client emits `subscribe` for the same symbol, then no additional upstream Finnhub subscribe message is sent (the existing upstream subscription is reused).
- [x] **AC4**: Given a symbol has exactly one remaining watching client, when that client emits `unsubscribe` for the symbol (or disconnects, per AC5), then the service sends a Finnhub upstream unsubscribe message for that symbol and stops requesting further ticks for it.
- [x] **AC5**: Given a client disconnects (tab closed, network drop, navigation away) without having sent an explicit `unsubscribe`, when the server's Socket.io `disconnect` handler runs, then it decrements that client's watch count for every symbol it held exactly as an explicit `unsubscribe` would, including triggering AC4's upstream unsubscribe if it was the last watcher.
- [x] **AC6**: Given a client sends `subscribe` immediately followed by `unsubscribe` for the same symbol before the upstream subscribe call resolves (interleaved async operations), when both have been processed, then the service's final state reflects the last intended action (no dangling upstream subscription with zero current watchers, and no upstream unsubscribe sent while a watcher remains).
- [x] **AC7**: Given a client emits `subscribe` for a symbol not present in the service's configured supported-symbol set (union of the ticker, index, and featured symbol groups — see section 4), when processed, then the server emits `market:error` with code `UNSUPPORTED_SYMBOL` to that client and does not attempt any upstream Finnhub action for it.

### Redis caching (TTL 60s)
- [x] **AC8**: Given the service receives a tick from the upstream Finnhub connection for symbol X, when it processes the tick, then it writes the latest price to a Redis key namespaced by symbol with a TTL of 60 seconds, and the TTL is reset to 60 seconds on every subsequent tick for that symbol.
- [x] **AC9**: Given a client emits `subscribe` for a symbol that has a non-expired cached value in Redis, when the subscription is processed, then the server immediately emits one `quote:update` event to that client containing the cached value (marked `stale: false`), without waiting for a new upstream tick.
- [x] **AC10**: Given a client emits `subscribe` for a symbol with no cached value in Redis (cache miss or expired), when the subscription is processed, then the service performs a one-shot Finnhub REST `/quote` fetch for that symbol, writes the result into the Redis cache (same key/TTL as AC8), and immediately emits one `quote:update` to that client. If the REST fetch fails or returns no usable price, no immediate `quote:update` is emitted and the client receives its first update only when the next upstream WebSocket tick or heartbeat (AC22) arrives.

### Reconnection & resilience
- [x] **AC11**: Given the upstream Finnhub WebSocket connection drops unexpectedly, when the service schedules reconnect attempts, then each successive retry delay is strictly greater than the previous one up to a configured maximum cap (exponential backoff), not a fixed/constant interval.
- [x] **AC12**: Given the upstream connection is successfully reestablished after one or more failed attempts, when reconnection completes, then the service re-sends upstream subscribe messages for every symbol that still has at least one active client watching it (subscription state is restored, not lost).
- [x] **AC13**: Given the upstream connection reconnects and remains stable, when a later disconnect occurs, then the backoff delay sequence restarts from its base delay rather than continuing from the previous attempt's (higher) delay.
- [x] **AC14**: Given the upstream Finnhub connection is down or reconnecting, when connected Socket.io clients are affected, then the service emits a `market:status` event with `status: "degraded"` (or `"reconnecting"`) to all connected clients, and emits `status: "connected"` once the upstream connection is restored.
- [x] **AC15**: Given Redis is unreachable (connection refused/timeout), when a tick arrives from the upstream feed, then the service still relays that tick live to subscribed clients (cache read/write is skipped, not blocking, for that tick) and logs a Redis-connectivity error, rather than crashing the process or blocking fan-out.

### Backpressure
- [x] **AC16**: Given the internal outbound tick-publish queue depth exceeds a configured threshold, when additional ticks continue to arrive before the queue drains back under that threshold, then the service discards the oldest queued ticks first (not the newest) to bring the queue back to or under the threshold.
- [x] **AC17**: Given a drop occurs per AC16, when the event is logged, then the log entry is at `warn` level or higher and includes the affected symbol, the number of ticks dropped, and a timestamp.

### Authentication (Socket.io)
- [x] **AC18**: Given a Socket.io client connects to the `/market` namespace presenting a valid, unexpired access token (verified against the API's RS256 public key) in the handshake, when the handshake completes, then the connection is accepted and the client may emit `subscribe`/`unsubscribe`.
- [x] **AC19**: Given a Socket.io client connects with a missing, malformed, or expired access token, when the handshake is processed, then the server rejects the connection (`connect_error`) before creating any subscription state for that client, and no upstream Finnhub action is triggered on its behalf.
- [x] **AC20**: Given a Socket.io client connects with a token that is well-formed and unexpired but whose signature does not verify against the API's public key (tampered token), when the handshake is processed, then it is rejected identically to AC19 (no distinguishing error detail is returned to the client).

### Update cadence & data labeling
- [x] **AC21**: Given upstream ticks for a subscribed symbol arrive faster than one per second, when the service fans them out, then a given client receives at most one `quote:update` event per symbol per rolling 1-second window, using the most recent price within that window.
- [x] **AC22**: Given no new upstream tick arrives for a subscribed symbol within 5 seconds of the last update emitted to a client, when 5 seconds elapse, then the service emits a heartbeat `quote:update` (last known cached price, `stale: true` if the Redis TTL has since expired, fresh `timestamp`) so the client can distinguish "no new trade" from "feed stalled."
- [x] **AC23**: Given any `quote:update` payload delivered over the socket, when inspected, then it includes `delayed: true` and `delayMinutes: 15`, and `price`/`change`/`changePercent` are transmitted as strings, never as JS `number`.
- [ ] **AC24**: Given the `/app/market` page is rendered, when a user views it, then a visible, persistent label states the data is delayed by 15 minutes and provided for educational/simulated purposes, and the platform-wide "Modo Simulador" badge (per CLAUDE.md) is present.

### Frontend `/app/market` page
- [ ] **AC25**: Given an authenticated user navigates to `/app/market`, when the page loads, then a Server Component shell renders the static structure (headings, section containers, the AC24 disclaimer and badge) without embedding any live price values, and no client-side JavaScript is required to see that static structure (testable via `curl`/no-JS check, structure only — not live data).
- [ ] **AC26**: Given the page's static shell has rendered, when the live-data Client Component(s) mount but have not yet received any socket data, then each section (ticker bar, index cards, chart, table) shows an explicit loading/skeleton state, never a blank, zero, or fabricated value.
- [ ] **AC27**: Given the Client Component(s) responsible for live data, when the component source is inspected, then each carries `"use client"` with a one-line comment justifying the boundary (socket connection / local state), per CLAUDE.md convention.
- [ ] **AC28**: Given the `/app/market` page has mounted, when rendered, then it displays a ticker bar showing the 6 configured ticker symbols with price and change for each.
- [ ] **AC29**: Given the `/app/market` page has mounted, when rendered, then it displays 4 index cards, one each labeled "S&P 500," "NASDAQ," "DOW," and "BTC/USD," each showing price and change — the S&P 500/NASDAQ/DOW cards are sourced from their tracking-ETF proxies (SPY/QQQ/DIA respectively, per section 4) but display the index label, not the ETF ticker.
- [ ] **AC30**: Given the `/app/market` page has mounted, when rendered, then it displays a line chart covering the trailing 24 hours of price data for a default/selected symbol, with new points appended as live updates arrive.
- [ ] **AC31**: Given the market-stream service has been accumulating a symbol's tick history for less than 24 hours (e.g., freshly deployed), when the chart renders, then it shows only the range actually accumulated so far and visibly labels that shorter range, rather than fabricating or backfilling earlier data points from any external source.
- [ ] **AC32**: Given the `/app/market` page has mounted, when rendered, then it displays a featured-stocks table listing the configured featured symbols with columns for symbol, price, change, change percent, and last-updated time.
- [ ] **AC33**: Given the underlying Socket.io connection for `/app/market` disconnects (network blip, server restart, or an upstream-degraded `market:status` event per AC14), when the UI reflects this, then it shows a visible "reconnecting" / "data may be delayed" indicator rather than silently freezing stale numbers with no explanation.
- [ ] **AC34**: Given the client's socket reconnects after a drop (e.g., server restart), when the `connect` event fires again, then the client re-emits `subscribe` for every symbol required by the currently rendered sections (ticker, index, chart's default symbol, featured table) — it does not rely on server-side state surviving the restart.
- [ ] **AC35**: Given a user navigates away from `/app/market` (component unmount), when the unmount runs, then the client emits `unsubscribe` for every symbol it had subscribed to before releasing the socket, so the server-side watch counts described in AC4/AC5 stay accurate.

## 4. Technical Contracts

### Socket.io namespace & events (`apps/market-stream`)

No REST endpoints are introduced by this spec; all market data flows through
the Socket.io `/market` namespace described below.

**Handshake / auth**: client connects with `{ auth: { token: <accessToken> } }`.
The server verifies the token's RS256 signature against the API's public key
and its `exp` claim (see AC18–AC20). Verification happens once, at connect
time — see Open Questions for mid-session token expiry.

**Client → Server events**
| Event | Payload | Behavior |
|---|---|---|
| `subscribe` | `{ symbol: string }` | Registers this client as a watcher of `symbol`; triggers AC2/AC3/AC7/AC9/AC10. |
| `unsubscribe` | `{ symbol: string }` | Removes this client as a watcher of `symbol`; triggers AC4. |

**Server → Client events**
| Event | Payload | Behavior |
|---|---|---|
| `quote:update` | `QuoteDto` (below) | A price update for a symbol the client is subscribed to. |
| `market:status` | `MarketStatusEvent` | Upstream connection health changes (AC14). |
| `market:error` | `MarketErrorEvent` | Rejected subscribe request (AC7) or other recoverable error. |

### Shared types (`packages/shared-types/src/market.ts`)

```ts
export interface QuoteDto {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  timestamp: string; // ISO 8601
  delayed: true;
  delayMinutes: 15;
  stale?: boolean;
}

export interface MarketStatusEvent {
  status: "connected" | "degraded" | "reconnecting";
  message?: string;
}

export interface MarketErrorEvent {
  code: "UNSUPPORTED_SYMBOL" | "SUBSCRIBE_FAILED";
  symbol?: string;
  message: string;
}

// Server-configured symbol groups, shared so apps/web knows what to
// subscribe to and apps/market-stream knows what to accept (AC7).
export interface MarketSymbolGroups {
  ticker: string[]; // exactly 6 symbols
  indices: { label: "S&P 500" | "NASDAQ" | "DOW" | "BTC/USD"; symbol: string }[]; // exactly 4
  featured: string[];
}
```

Concrete `MarketSymbolGroups` values for this spec:

```ts
const MARKET_SYMBOL_GROUPS: MarketSymbolGroups = {
  ticker: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"],
  indices: [
    { label: "S&P 500", symbol: "SPY" },  // tracking-ETF proxy, not raw index ticker
    { label: "NASDAQ", symbol: "QQQ" },   // tracking-ETF proxy
    { label: "DOW", symbol: "DIA" },      // tracking-ETF proxy
    { label: "BTC/USD", symbol: "BINANCE:BTCUSDT" },
  ],
  featured: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"],
};
```

The three equity indices are sourced via tracking-ETF proxies (SPY/QQQ/DIA)
rather than raw index tickers, since Finnhub's free tier is not confirmed to
expose native index quotes — the UI still labels these cards "S&P 500,"
"NASDAQ," "DOW" per AC29; the ETF symbol is an internal implementation detail,
not user-facing copy. These are still config values (not hardcoded inline in
component source) so they can be adjusted without a spec change, but the
literal defaults above are pinned for this spec's acceptance criteria.

### Database changes

None. This feature persists no data to PostgreSQL. All state is in-memory
(per-process subscription/watch counts) or in Redis (60s price cache, and a
separate rolling-window store backing the 24h chart, self-accumulated from
live ticks — not backfilled from any Finnhub history endpoint, per section 9
resolution). No Prisma migration is required for this spec.

### Frontend routes / components (`apps/web/src/app`)

- `(app)/app/market/page.tsx` → `/app/market` — Server Component shell (AC25).
- `<MarketTicker />` — `"use client"` (holds live socket state) — ticker bar (AC28).
- `<MarketIndexCards />` — `"use client"` (holds live socket state) — 4 index cards (AC29).
- `<MarketChart />` — `"use client"` (holds live socket state + chart library instance) — 24h line chart (AC30, AC31).
- `<MarketFeaturedTable />` — `"use client"` (holds live socket state) — featured stocks table (AC32).
- `<MarketConnectionBanner />` — `"use client"` (subscribes to `market:status`/socket disconnect events) — reconnecting indicator (AC33).
- A shared client-side hook/provider (e.g. `useMarketSocket`) encapsulating the Socket.io connection, auth token attachment (reading the in-memory access token from spec 002's `<AuthProvider>`), subscribe/unsubscribe lifecycle (AC34, AC35), and heartbeat/staleness handling — used by all of the above Client Components rather than each opening its own socket connection.

## 5. Edge Cases & Errors

- **Finnhub upstream disconnects unexpectedly**: handled by AC11–AC14 (exponential backoff, re-subscription on recovery, `market:status` broadcast).
- **Redis unavailable**: handled by AC15 — live pass-through continues; only the cache-assisted "instant value on subscribe" (AC9) and the 24h history accumulation are degraded while Redis is down.
- **Client disconnects mid-subscription** (tab closed, laptop sleeps, network drop): handled by AC5 — treated identically to an explicit `unsubscribe` for cleanup purposes.
- **Invalid/expired token on socket connect**: handled by AC19/AC20 — connection rejected before any subscription state exists.
- **Symbol requested that isn't supported**: handled by AC7 — rejected with `market:error`, no upstream action.
- **Backpressure threshold hit**: handled by AC16/AC17 — oldest ticks dropped, drop logged at `warn`+.
- **Rapid subscribe/unsubscribe race for the same symbol from the same client**: handled by AC6 — final state must reflect the last intended action; no dangling upstream subscription with zero watchers.
- **market-stream process restart**: in-memory watch counts and upstream subscriptions are lost; this is acceptable because reconnecting clients re-subscribe on their own `connect` event (AC34) — the service does not need to persist subscription state across restarts.
- **Two clients concurrently subscribing to a brand-new symbol**: only one upstream subscribe message is sent (AC2/AC3); the second client's subscribe is a no-op against the upstream but still registers that client as a local watcher.
- **A symbol's cached price expires (TTL) with no new tick and no client currently watching it**: no action is required — the cache entry simply disappears; nothing is broadcast because there are no watchers.

## 6. Out of Scope

- User-customizable watchlists or arbitrary symbol search (persisted or not) — only the fixed, server-configured ticker/index/featured symbol groups are supported in this spec.
- Historical chart ranges beyond 24 hours (1W/1M/1Y), technical indicators, or candlestick chart types.
- Order placement / buy-sell simulation UI (future "invest" spec).
- Portfolio valuation using this market data (future "portfolio" spec).
- Data for markets/asset classes beyond the configured ticker/index/featured symbol groups (e.g., forex pairs beyond BTC/USD, commodities, options).
- Multi-instance/horizontal scaling of `apps/market-stream` (single-process assumption; no distributed subscriber-count coordination or cross-instance Redis pub/sub fan-out).
- Mid-session access-token refresh/re-authentication for an already-open Socket.io connection (see Open Questions) — this spec only specifies verification at initial handshake.
- Price-alert notifications or thresholds.
- A monitoring/admin dashboard for market-stream beyond structured logs (no Grafana/metrics UI is built by this spec).
- Native/mobile clients — web only.
- Non-`es` locale copy for this page (per spec 001's precedent).
- A REST snapshot endpoint on market-stream — all data delivery is via Socket.io (see section 4).

## 7. Implementation Notes

- Reconnect backoff: implementer chooses concrete base delay, multiplier, and max cap, documented in market-stream's config module (same pattern as spec 002's tunable security parameters) — not hardcoded magic numbers. Adding jitter to avoid thundering-herd reconnects is recommended but not an AC.
- Backpressure threshold: implementer chooses a concrete queue-depth number, documented in config, validated via `@nestjs/config` + Zod at startup (fail fast on missing/invalid env), consistent with CLAUDE.md's config convention.
- Public-key distribution for socket JWT verification: market-stream needs the same RS256 public key `apps/api` uses to sign access tokens. Exact distribution mechanism (shared env var, mounted key file, or a future JWKS endpoint) is an infra decision left to the implementer; it must not require market-stream to hold the private signing key.
- `useMarketSocket` should own a single Socket.io client instance per browser tab, shared across all live-updating components on the page, to avoid opening 5 separate connections for one page view.
- Watch-count bookkeeping (AC2–AC6) should use a single authoritative in-memory map (`symbol -> Set<clientId>`) updated synchronously within Node's event loop to avoid the interleaving issues described in AC6.
- Cache-miss bootstrap (AC10): market-stream may call Finnhub's REST `/quote` **server-side** to seed Redis and the subscribing client's first `quote:update`. This is not a client-facing REST snapshot endpoint (still out of scope per section 6) — Socket.io remains the only delivery path to the browser. Concurrent subscribe calls for the same symbol must share one in-flight REST request (dedupe) so the free-tier 60 req/min budget is not burned by a stampede.

## 8. Validation Plan

### Automated
- **Unit tests (Jest, `apps/market-stream`)**: watch-count refcounting (subscribe/unsubscribe/disconnect, including the AC6 race), exponential backoff delay sequence and reset-on-stability, backpressure drop-oldest logic and log shape, JWT verification (valid/expired/malformed/tampered), heartbeat scheduling (AC22), Redis-down fallback path (AC15).
- **Integration tests (Jest, `apps/market-stream`)**: Socket.io handshake accept/reject against a real (or in-memory) JWT keypair; subscribe/unsubscribe flow against a mocked Finnhub upstream, asserting exactly one upstream subscribe/unsubscribe call per transition; Redis TTL behavior (60s expiry, refresh-on-tick) against a real test Redis instance.
- **Unit tests (Vitest, `apps/web`)**: `useMarketSocket` subscribe-on-mount/unsubscribe-on-unmount/re-subscribe-on-reconnect behavior against a mocked socket.
- **E2E (Playwright)**: authenticated visit to `/app/market` shows skeleton then populated ticker/index/chart/table sections against a mocked market-stream backend; simulated socket disconnect shows the reconnecting banner (AC33); unauthenticated visit redirects to `/login` per spec 002's middleware.

### Manual
- Run market-stream against a real Finnhub sandbox/free-tier key; observe logs for reconnect backoff timing and any synthetic backpressure-drop events.
- Kill and restart market-stream while a browser tab is open on `/app/market`; confirm the page shows the reconnecting indicator and resumes live updates without a manual page refresh.
- Stop the local Redis container while market-stream is running; confirm live updates keep flowing (pass-through) and the connectivity error appears in logs, not a crash.

## 9. Open Questions

Resolved during spec review (2026-09-15):
- **Index symbol mapping** → tracking-ETF proxies (SPY/QQQ/DIA), pinned in section 4 and AC29.
- **24h chart history source** → self-accumulate from live ticks for all asset classes (no Finnhub history-endpoint dependency), pinned in section 4 and AC31.
- **Exact literal symbol lists** → pinned in section 4 (`MARKET_SYMBOL_GROUPS`).

Still open:
- **Mid-session token expiry on an open socket**: access tokens are 15 minutes; this spec verifies the token once at connect (AC18–AC20) but does not mandate behavior once that token's `exp` passes while the socket remains open (proactive server-side disconnect vs. leaving it connected until the next natural reconnect). Flagged as out of scope for now (section 6) rather than guessed at — a future spec revision should decide this explicitly.
