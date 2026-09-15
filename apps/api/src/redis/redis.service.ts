import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvConfig } from '../config/env.schema';

/**
 * Read-only client against the same Redis instance apps/market-stream
 * caches prices in (spec 004 section 4). apps/api never writes here and
 * never talks to Finnhub — that stays exclusively apps/market-stream's job
 * per CLAUDE.md.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  onModuleInit(): void {
    this.client = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    // A connection error must never crash the process — the pricing
    // contract (spec 004 section 4) treats an unreachable Redis exactly
    // like a cache miss, falling back to averagePrice.
    this.client.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Returns the raw cached value at `key`, or `null` on a miss, an
   * expired key, or if Redis is unreachable — callers treat all three
   * identically (AC13/AC14).
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }
}
