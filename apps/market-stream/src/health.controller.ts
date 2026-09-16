import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@capitalflow/shared-types';
import { QuoteCacheService } from './redis/quote-cache.service';
import { FinnhubService } from './finnhub/finnhub.service';

/**
 * Spec 006 AC26: `GET /health` (and `GET /` for Render's default probe).
 * No auth guard — reachable by Render's health check and the repo's
 * keep-alive workflow.
 *
 * Deliberate, human-approved asymmetry versus apps/api's `/health`: this
 * endpoint ALWAYS returns HTTP 200, even when `status` is `"degraded"`.
 * market-stream's job is to degrade gracefully (cached prices in
 * `QuoteCacheService`, Finnhub reconnect-with-backoff in `FinnhubService`),
 * so Render must never restart the process over a transient Redis or
 * Finnhub blip — a 503 here would do exactly that.
 *
 * `status` depends ONLY on Redis reachability. Finnhub being disconnected
 * does not flip `status` to `"degraded"` — it only affects the `finnhub`
 * field — because a Finnhub outage is already handled by serving last
 * cached prices (edge case in spec 006 section 5), which is a `redis`
 * concern, not a `finnhub` one.
 */
@Controller()
export class HealthController {
  constructor(
    private readonly quoteCache: QuoteCacheService,
    private readonly finnhub: FinnhubService,
  ) {}

  @Get()
  root(): HealthResponse {
    return this.buildResponse();
  }

  @Get('health')
  health(): HealthResponse {
    return this.buildResponse();
  }

  private buildResponse(): HealthResponse {
    const redis = this.quoteCache.isUnreachable() ? 'error' : 'ok';
    const finnhub = this.finnhub.isConnected() ? 'connected' : 'disconnected';
    const version = process.env.RENDER_GIT_COMMIT;

    return {
      status: redis === 'error' ? 'degraded' : 'ok',
      uptime: process.uptime(),
      service: 'market-stream',
      ...(version ? { version } : {}),
      redis,
      finnhub,
    };
  }
}
