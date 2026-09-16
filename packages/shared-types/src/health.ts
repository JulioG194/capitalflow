/**
 * Shared `GET /health` response contract (spec 006 AC25/AC26, Technical
 * Contracts section). Outbound-only shape (server -> reviewer/uptime-check),
 * so — like `QuoteDto`/`MarketStatusEvent` in `market.ts` — there is no
 * matching zod schema to validate an inbound payload against.
 *
 * `db`/`redis`/`finnhub` are all optional on the shared type since a single
 * response only ever populates the subset relevant to its own service
 * (`db` for apps/api, `redis`/`finnhub` for apps/market-stream) — narrowing
 * to a per-service type isn't worth two near-duplicate interfaces for three
 * fields.
 */
export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  uptime: number; // seconds
  service: 'api' | 'market-stream';
  version?: string; // git SHA if available
  db?: 'ok' | 'error'; // api only
  redis?: 'ok' | 'error'; // market-stream only
  finnhub?: 'connected' | 'disconnected'; // market-stream only
}
