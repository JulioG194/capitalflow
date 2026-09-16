import { Logger } from '@nestjs/common';
import type { QuoteDto } from '@capitalflow/shared-types';
import { FanoutService } from './fanout.service';
import type { QuoteCacheService } from '../redis/quote-cache.service';
import { AppConfigService } from '../config/app-config.service';

function configStub(): AppConfigService {
  const values: Record<string, number> = {
    FANOUT_QUEUE_MAX_DEPTH: 3,
    QUOTE_THROTTLE_MS: 1000,
    HEARTBEAT_INTERVAL_MS: 5000,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as AppConfigService;
}

function cacheStub(overrides?: Partial<QuoteCacheService>): QuoteCacheService {
  return {
    writeQuote: jest.fn().mockResolvedValue(undefined),
    readQuote: jest.fn().mockResolvedValue({
      price: '10.00',
      timestamp: new Date().toISOString(),
      change: '0.00',
      changePercent: '0.00',
    }),
    isUnreachable: jest.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as QuoteCacheService;
}

describe('FanoutService (AC15/AC16/AC21/AC22/AC23)', () => {
  let now = 1_000_000;
  let emitted: QuoteDto[];
  let fanout: FanoutService;
  let cache: QuoteCacheService;
  // Kept as its own `jest.Mock`-typed reference (rather than read back via
  // `cache.writeQuote`) so assertions on it don't extract an unbound class
  // method from `cache` (`@typescript-eslint/unbound-method`).
  let writeQuote: jest.Mock;

  beforeEach(() => {
    now = 1_000_000;
    emitted = [];
    writeQuote = jest.fn().mockResolvedValue(undefined);
    cache = cacheStub({ writeQuote });
    fanout = new FanoutService(configStub(), cache);
    fanout.setClock(() => now);
    fanout.setPublisher((_symbol, quote) => {
      emitted.push(quote);
    });
  });

  it('AC21: emits at most one update per symbol per rolling 1s window, using the newest price', async () => {
    fanout.ingestTick('AAPL', 10, now);
    fanout.ingestTick('AAPL', 11, now + 10);
    fanout.ingestTick('AAPL', 12, now + 20);
    await fanout.flush();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.price).toBe('12.00');

    fanout.ingestTick('AAPL', 13, now + 100);
    await fanout.flush();
    expect(emitted).toHaveLength(1);

    now += 1000;
    fanout.ingestTick('AAPL', 14, now);
    await fanout.flush();
    expect(emitted).toHaveLength(2);
    expect(emitted[1]?.price).toBe('14.00');
  });

  it('AC23: emitted payloads use string money fields and delayed: true', async () => {
    fanout.ingestTick('AAPL', 189.5, now);
    await fanout.flush();
    expect(emitted[0]).toMatchObject({
      symbol: 'AAPL',
      delayed: true,
      delayMinutes: 15,
    });
    expect(typeof emitted[0]?.price).toBe('string');
    expect(typeof emitted[0]?.change).toBe('string');
  });

  it('AC16/AC17: overflow drops oldest ticks and still emits the newest', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    fanout.ingestTick('AAPL', 1, now);
    fanout.ingestTick('AAPL', 2, now);
    fanout.ingestTick('AAPL', 3, now);
    fanout.ingestTick('AAPL', 4, now);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /Dropped \d+ queued ticks for AAPL at /,
    );
    await fanout.flush();
    expect(emitted[0]?.price).toBe('4.00');
    warn.mockRestore();
  });

  it('AC15: still emits live ticks when Redis writes fail', async () => {
    writeQuote.mockRejectedValue(new Error('ECONNREFUSED'));
    fanout.ingestTick('AAPL', 10, now);
    await fanout.flush();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.price).toBe('10.00');
  });

  it('AC22: heartbeats after 5s of silence with a fresh timestamp', async () => {
    fanout.ingestTick('AAPL', 10, now);
    await fanout.flush();
    expect(emitted).toHaveLength(1);
    const firstTimestamp = emitted[0]?.timestamp;

    now += 5000;
    await fanout.flush();
    expect(emitted.length).toBeGreaterThanOrEqual(2);
    const heartbeat = emitted[emitted.length - 1];
    expect(heartbeat?.price).toBe('10.00');
    expect(heartbeat?.timestamp).not.toBe(firstTimestamp);
  });

  it('AC22: marks heartbeat stale when Redis has expired the key', async () => {
    (cache.readQuote as jest.Mock).mockResolvedValue(null);
    fanout.ingestTick('AAPL', 10, now);
    await fanout.flush();
    now += 5000;
    await fanout.flush();
    expect(emitted[emitted.length - 1]?.stale).toBe(true);
  });

  it('AC10: seedQuote caches last price so heartbeats work before any WS tick', async () => {
    fanout.seedQuote(
      {
        symbol: 'AAPL',
        price: '190.50',
        change: '-1.25',
        changePercent: '-0.65',
        timestamp: new Date(now).toISOString(),
        delayed: true,
        delayMinutes: 15,
      },
      '191.75',
    );
    expect(writeQuote).toHaveBeenCalled();
    expect(fanout.getLastQuote('AAPL')?.price).toBe('190.50');

    now += 5000;
    await fanout.flush();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.price).toBe('190.50');
  });
});
