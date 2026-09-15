import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { QuoteDto } from '@capitalflow/shared-types';
import { AppConfigService } from '../config/app-config.service';

export const quoteCacheKey = (symbol: string): string => `market:quote:${symbol}`;
export const historyKey = (symbol: string): string => `market:history:${symbol}`;

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

type CachedQuote = {
  price: string;
  timestamp: string;
  change: string;
  changePercent: string;
};

/**
 * Redis writer for spec 003 AC8/AC15 and spec 004's `market:quote:<symbol>`
 * contract. Every Redis failure is swallowed (logged) so a down cache never
 * crashes the process or blocks live fan-out (AC15).
 */
@Injectable()
export class QuoteCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(QuoteCacheService.name);
  private readonly client: Redis;
  private redisDown = false;

  constructor(private readonly config: AppConfigService) {
    this.client = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (error: Error) => {
      this.redisDown = true;
      this.logger.error(`Redis connectivity error: ${error.message}`);
    });
    this.client.on('ready', () => {
      this.redisDown = false;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  isUnreachable(): boolean {
    return this.redisDown;
  }

  async writeQuote(quote: QuoteDto): Promise<void> {
    const payload: CachedQuote = {
      price: quote.price,
      timestamp: quote.timestamp,
      change: quote.change,
      changePercent: quote.changePercent,
    };
    const ttl = this.config.get('REDIS_QUOTE_TTL_SECONDS', { infer: true });
    try {
      await this.client.set(
        quoteCacheKey(quote.symbol),
        JSON.stringify(payload),
        'EX',
        ttl,
      );
      this.redisDown = false;
    } catch (error) {
      this.redisDown = true;
      this.logger.error(
        `Redis write failed for ${quote.symbol}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    await this.appendHistory(quote.symbol, quote.price, quote.timestamp);
  }

  async readQuote(symbol: string): Promise<CachedQuote | null> {
    try {
      const raw = await this.client.get(quoteCacheKey(symbol));
      this.redisDown = false;
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CachedQuote;
      if (!parsed.price || !parsed.timestamp) {
        return null;
      }
      return parsed;
    } catch (error) {
      this.redisDown = true;
      this.logger.error(
        `Redis read failed for ${symbol}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  private async appendHistory(
    symbol: string,
    price: string,
    timestamp: string,
  ): Promise<void> {
    const at = Date.parse(timestamp);
    if (!Number.isFinite(at)) {
      return;
    }
    const cutoff = Date.now() - HISTORY_WINDOW_MS;
    try {
      const key = historyKey(symbol);
      await this.client.zadd(key, at, `${at}:${price}`);
      await this.client.zremrangebyscore(key, '-inf', cutoff);
    } catch (error) {
      this.redisDown = true;
      this.logger.error(
        `Redis history write failed for ${symbol}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
