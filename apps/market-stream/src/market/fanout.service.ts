import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { QuoteDto } from '@capitalflow/shared-types';
import { AppConfigService } from '../config/app-config.service';
import { QuoteCacheService } from '../redis/quote-cache.service';
import { TickQueue } from './tick-queue';
import { diffFromBaseline, numberToPriceString, toQuoteDto } from './quote.util';

export type QuotePublisher = (symbol: string, quote: QuoteDto) => void;

/**
 * Coalesces upstream ticks into at most one `quote:update` per symbol per
 * rolling 1s window (AC21), heartbeats after 5s of silence (AC22), and
 * drops the oldest queued ticks under backpressure (AC16/AC17). Redis
 * writes never block live emit (AC15).
 */
@Injectable()
export class FanoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FanoutService.name);
  private readonly queue: TickQueue;
  private readonly lastEmittedAt = new Map<string, number>();
  private readonly lastQuote = new Map<string, QuoteDto>();
  private readonly pending = new Map<string, QuoteDto>();
  private readonly sessionBaseline = new Map<string, string>();
  private publisher: QuotePublisher | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private clock: () => number = Date.now;

  constructor(
    private readonly config: AppConfigService,
    private readonly cache: QuoteCacheService,
  ) {
    this.queue = new TickQueue(
      this.config.get('FANOUT_QUEUE_MAX_DEPTH', { infer: true }),
    );
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, 250);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setPublisher(publisher: QuotePublisher): void {
    this.publisher = publisher;
  }

  /** Test seam: inject a deterministic clock without fake timers. */
  setClock(clock: () => number): void {
    this.clock = clock;
  }

  ingestTick(symbol: string, price: number, timestampMs: number): void {
    const quote = this.buildQuote(symbol, price, timestampMs);
    this.lastQuote.set(symbol, quote);
    void this.cache.writeQuote(quote).catch(() => undefined);

    const dropped = this.queue.enqueue({
      symbol,
      price,
      timestampMs,
    });
    for (const drop of dropped) {
      // AC17: warn+, include symbol, dropped count, and timestamp.
      this.logger.warn(
        `Dropped ${drop.count} queued ticks for ${drop.symbol} at ${new Date(this.clock()).toISOString()}`,
      );
    }
  }

  async flush(): Promise<void> {
    const now = this.clock();
    const throttleMs = this.config.get('QUOTE_THROTTLE_MS', { infer: true });
    const heartbeatMs = this.config.get('HEARTBEAT_INTERVAL_MS', {
      infer: true,
    });

    const latest = this.queue.drainLatestBySymbol();
    for (const [symbol, tick] of latest) {
      const quote = this.buildQuote(symbol, tick.price, tick.timestampMs);
      this.lastQuote.set(symbol, quote);
      this.pending.set(symbol, quote);
    }

    for (const [symbol, quote] of this.pending) {
      const last = this.lastEmittedAt.get(symbol) ?? 0;
      if (last === 0 || now - last >= throttleMs) {
        this.emit(symbol, quote);
        this.pending.delete(symbol);
      }
    }

    const heartbeats: Promise<void>[] = [];
    for (const [symbol, quote] of this.lastQuote) {
      const last = this.lastEmittedAt.get(symbol) ?? 0;
      if (last > 0 && now - last >= heartbeatMs && !this.pending.has(symbol)) {
        heartbeats.push(this.emitHeartbeat(symbol, quote, now));
      }
    }
    await Promise.all(heartbeats);
  }

  getLastQuote(symbol: string): QuoteDto | undefined {
    return this.lastQuote.get(symbol);
  }

  /**
   * Seeds fan-out memory from a REST bootstrap quote (AC10) so heartbeats
   * (AC22) have a last-known price even before the first WebSocket trade.
   * `previousClose` becomes the session baseline for subsequent live ticks.
   */
  seedQuote(quote: QuoteDto, previousClose: string): void {
    this.lastQuote.set(quote.symbol, quote);
    this.sessionBaseline.set(quote.symbol, previousClose);
    this.lastEmittedAt.set(quote.symbol, this.clock());
    void this.cache.writeQuote(quote).catch(() => undefined);
  }

  private emit(symbol: string, quote: QuoteDto): void {
    this.lastEmittedAt.set(symbol, this.clock());
    this.publisher?.(symbol, quote);
  }

  private async emitHeartbeat(
    symbol: string,
    last: QuoteDto,
    now: number,
  ): Promise<void> {
    const cached = await this.cache.readQuote(symbol);
    const stale = cached === null || this.cache.isUnreachable();
    const heartbeat = toQuoteDto({
      symbol,
      price: last.price,
      change: last.change,
      changePercent: last.changePercent,
      timestamp: new Date(now).toISOString(),
      stale,
    });
    this.lastQuote.set(symbol, heartbeat);
    this.emit(symbol, heartbeat);
  }

  private buildQuote(
    symbol: string,
    price: number,
    timestampMs: number,
  ): QuoteDto {
    const priceString = numberToPriceString(price);
    let baseline = this.sessionBaseline.get(symbol);
    if (!baseline) {
      baseline = priceString;
      this.sessionBaseline.set(symbol, baseline);
    }
    const { change, changePercent } = diffFromBaseline(priceString, baseline);
    return toQuoteDto({
      symbol,
      price: priceString,
      change,
      changePercent,
      timestamp: new Date(timestampMs).toISOString(),
      stale: false,
    });
  }
}
