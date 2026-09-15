import {
  FinnhubQuoteClient,
  parseQuoteResponse,
  restSnapshotToStrings,
  type RestQuoteSnapshot,
} from './finnhub-quote.client';
import type { AppConfigService } from '../config/app-config.service';

describe('FinnhubQuoteClient parsers (AC10)', () => {
  it('parses a normal Finnhub /quote payload', () => {
    const snapshot = parseQuoteResponse({
      c: 190.5,
      d: -1.25,
      dp: -0.652,
      pc: 191.75,
      t: 1_700_000_000,
    });
    expect(snapshot).toEqual({
      price: 190.5,
      change: -1.25,
      changePercent: -0.652,
      previousClose: 191.75,
      timestampMs: 1_700_000_000_000,
    });
  });

  it('rejects zero / missing current price', () => {
    expect(parseQuoteResponse({ c: 0, d: 0, dp: 0, pc: 0, t: 0 })).toBeNull();
    expect(parseQuoteResponse({ c: null })).toBeNull();
  });

  it('stringifies snapshot fields for QuoteDto / Redis', () => {
    const snapshot: RestQuoteSnapshot = {
      price: 100,
      change: 1.5,
      changePercent: 1.5,
      previousClose: 98.5,
      timestampMs: Date.UTC(2026, 0, 1),
    };
    const strings = restSnapshotToStrings(snapshot);
    expect(strings.price).toBe('100.00');
    expect(strings.change).toBe('1.50');
    expect(strings.changePercent).toBe('1.50');
    expect(strings.previousClose).toBe('98.50');
    expect(strings.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('FinnhubQuoteClient.fetchQuote dedupe (AC10)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shares one in-flight HTTP request per symbol', async () => {
    let resolveResponse!: (value: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = jest.fn().mockReturnValue(responsePromise);
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new FinnhubQuoteClient({
      get: (key: string) => {
        if (key === 'FINNHUB_REST_URL') return 'https://finnhub.io/api/v1';
        if (key === 'FINNHUB_API_KEY') return 'test-key';
        throw new Error(key);
      },
    } as unknown as AppConfigService);

    const first = client.fetchQuote('AAPL');
    const second = client.fetchQuote('AAPL');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(
      new Response(
        JSON.stringify({ c: 10, d: 0.5, dp: 5, pc: 9.5, t: 1_700_000_000 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const [a, b] = await Promise.all([first, second]);
    expect(a?.price).toBe(10);
    expect(b?.price).toBe(10);
  });
});
