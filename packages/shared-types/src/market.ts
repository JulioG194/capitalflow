import { z } from 'zod';

/**
 * Single-sourced delay literal (spec 003 AC23/AC24): every `quote:update`
 * payload carries this value, and the future `/app/market` disclaimer (AC24,
 * out of scope for this pass) must display the same number — never
 * duplicated as a bare `15` in either app.
 */
export const MARKET_DATA_DELAY_MINUTES = 15 as const;

/**
 * Price update pushed over the `/market` Socket.io namespace (spec 003
 * section 4). `price`/`change`/`changePercent` are strings, never JS
 * `number`, so precision is never silently lost in transit (CLAUDE.md:
 * never use `number` for money-like values).
 */
export interface QuoteDto {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  timestamp: string; // ISO 8601
  delayed: true;
  delayMinutes: typeof MARKET_DATA_DELAY_MINUTES;
  stale?: boolean;
}

/** Upstream (Finnhub) connection health broadcast to all clients (AC14). */
export interface MarketStatusEvent {
  status: 'connected' | 'degraded' | 'reconnecting';
  message?: string;
}

/** Rejected subscribe request (AC7) or other recoverable client-facing error. */
export interface MarketErrorEvent {
  code: 'UNSUPPORTED_SYMBOL' | 'SUBSCRIBE_FAILED';
  symbol?: string;
  message: string;
}

/**
 * Server-configured symbol groups, shared so `apps/web` knows what to
 * subscribe to and `apps/market-stream` knows what to accept (AC7).
 */
export interface MarketSymbolGroups {
  ticker: string[]; // exactly 6 symbols
  indices: {
    label: 'S&P 500' | 'NASDAQ' | 'DOW' | 'BTC/USD';
    symbol: string;
  }[]; // exactly 4
  featured: string[];
}

/**
 * Concrete symbol configuration pinned for spec 003 (section 4). The three
 * equity indices are tracking-ETF proxies (SPY/QQQ/DIA), not raw index
 * tickers — Finnhub's free tier doesn't confirm native index quote support.
 * The UI still labels these cards by their index `label`, never the ETF
 * `symbol` (AC29, out of scope for this pass).
 */
export const MARKET_SYMBOL_GROUPS: MarketSymbolGroups = {
  ticker: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'],
  indices: [
    { label: 'S&P 500', symbol: 'SPY' }, // tracking-ETF proxy, not raw index ticker
    { label: 'NASDAQ', symbol: 'QQQ' }, // tracking-ETF proxy
    { label: 'DOW', symbol: 'DIA' }, // tracking-ETF proxy
    { label: 'BTC/USD', symbol: 'BINANCE:BTCUSDT' },
  ],
  featured: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'],
};

/**
 * Client -> server `subscribe`/`unsubscribe` payload (spec 003 section 4).
 * Not part of the spec's literal type block, but added per CLAUDE.md's DTO
 * convention (class-validator DTOs mirror a shared zod schema) — this is
 * the only client-originated payload shape `apps/market-stream` needs to
 * validate, so it's single-sourced here rather than duplicated inline.
 */
export const subscribePayloadSchema = z.object({
  symbol: z.string().min(1),
});
export type SubscribePayloadInput = z.infer<typeof subscribePayloadSchema>;

/** `unsubscribe` shares the exact same shape as `subscribe` (just a symbol). */
export const unsubscribePayloadSchema = subscribePayloadSchema;
export type UnsubscribePayloadInput = z.infer<typeof unsubscribePayloadSchema>;
