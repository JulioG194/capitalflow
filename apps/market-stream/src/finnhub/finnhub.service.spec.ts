import { FinnhubService } from './finnhub.service';
import { AppConfigService } from '../config/app-config.service';
import {
  type FinnhubSocketFactory,
  type FinnhubSocketLike,
} from './finnhub-socket';

class MockSocket implements FinnhubSocketLike {
  sent: string[] = [];
  closed = false;
  private readonly handlers: Record<string, Array<(payload?: Buffer | Error) => void>> =
    {
      open: [],
      message: [],
      close: [],
      error: [],
    };

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    for (const handler of this.handlers.close) {
      handler();
    }
  }

  on(
    event: 'open' | 'message' | 'close' | 'error',
    handler: (payload?: Buffer | Error) => void,
  ): void {
    this.handlers[event].push(handler);
  }

  emitOpen(): void {
    for (const handler of this.handlers.open) {
      handler();
    }
  }

  emitMessage(json: unknown): void {
    for (const handler of this.handlers.message) {
      handler(Buffer.from(JSON.stringify(json)));
    }
  }
}

function configStub(): AppConfigService {
  const values = {
    FINNHUB_WS_URL: 'wss://ws.finnhub.io',
    FINNHUB_API_KEY: 'test-key',
    FINNHUB_RECONNECT_BASE_MS: 1000,
    FINNHUB_RECONNECT_MULTIPLIER: 2,
    FINNHUB_RECONNECT_MAX_MS: 8000,
  };
  return {
    get: (key: string) => values[key as keyof typeof values],
  } as unknown as AppConfigService;
}

describe('FinnhubService (AC1/AC2/AC3/AC4/AC6/AC11/AC12/AC13)', () => {
  let sockets: MockSocket[];
  let factory: FinnhubSocketFactory;
  let service: FinnhubService;

  beforeEach(() => {
    jest.useFakeTimers();
    sockets = [];
    factory = () => {
      const socket = new MockSocket();
      sockets.push(socket);
      return socket;
    };
    service = new FinnhubService(configStub(), factory);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('AC1: opens exactly one upstream socket on init', () => {
    service.onModuleInit();
    expect(sockets).toHaveLength(1);
  });

  it('AC2/AC3: first desired symbol sends subscribe; a second client does not', () => {
    service.onModuleInit();
    sockets[0]?.emitOpen();
    service.setDesiredSymbols(['AAPL']);
    service.setDesiredSymbols(['AAPL']);
    const subscribes = sockets[0]?.sent.filter((s) =>
      s.includes('"subscribe"'),
    );
    expect(subscribes).toHaveLength(1);
    expect(subscribes?.[0]).toContain('AAPL');
  });

  it('AC4: dropping the last watcher sends unsubscribe', () => {
    service.onModuleInit();
    sockets[0]?.emitOpen();
    service.setDesiredSymbols(['AAPL']);
    service.setDesiredSymbols([]);
    expect(sockets[0]?.sent.some((s) => s.includes('"unsubscribe"'))).toBe(
      true,
    );
  });

  it('AC6: subscribe then unsubscribe before open sends nothing dangling', () => {
    service.onModuleInit();
    service.setDesiredSymbols(['AAPL']);
    service.setDesiredSymbols([]);
    sockets[0]?.emitOpen();
    expect(sockets[0]?.sent).toEqual([]);
  });

  it('AC12: reconnect resubscribes every still-desired symbol', () => {
    service.onModuleInit();
    sockets[0]?.emitOpen();
    service.setDesiredSymbols(['AAPL', 'MSFT']);
    sockets[0]?.close();
    jest.advanceTimersByTime(1000);
    sockets[1]?.emitOpen();
    const symbols = sockets[1]?.sent.map(
      (raw) => (JSON.parse(raw) as { symbol: string }).symbol,
    );
    expect(symbols?.sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('AC11/AC13: reconnect delays grow, then reset to base after a successful open', () => {
    const statuses: string[] = [];
    service.onStatus((status) => statuses.push(status));
    service.onModuleInit();
    sockets[0]?.emitOpen();
    sockets[0]?.close();
    expect(statuses).toContain('reconnecting');
    jest.advanceTimersByTime(1000);
    sockets[1]?.close();
    jest.advanceTimersByTime(2000);
    sockets[2]?.emitOpen();
    expect(service.currentStatus()).toBe('connected');
    sockets[2]?.close();
    // After a successful open, the next delay is the base (1000), not 4000.
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it('forwards trade ticks to listeners', () => {
    const ticks: Array<{ symbol: string; price: number }> = [];
    service.onTick((symbol, price) => ticks.push({ symbol, price }));
    service.onModuleInit();
    sockets[0]?.emitOpen();
    sockets[0]?.emitMessage({
      type: 'trade',
      data: [{ s: 'AAPL', p: 189.5, t: 1 }],
    });
    expect(ticks).toEqual([{ symbol: 'AAPL', price: 189.5 }]);
  });
});
