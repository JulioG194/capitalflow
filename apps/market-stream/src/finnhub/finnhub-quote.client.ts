import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { numberToPriceString } from '../market/quote.util';

export type RestQuoteSnapshot = {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  timestampMs: number;
};

type FinnhubQuoteResponse = {
  c?: unknown;
  d?: unknown;
  dp?: unknown;
  pc?: unknown;
  t?: unknown;
};

/**
 * One-shot Finnhub REST `/quote` client for AC10 cache-miss bootstrap.
 * In-flight requests are deduped per symbol so concurrent Socket.io
 * subscribers share a single upstream HTTP call.
 */
@Injectable()
export class FinnhubQuoteClient {
  private readonly logger = new Logger(FinnhubQuoteClient.name);
  private readonly inflight = new Map<string, Promise<RestQuoteSnapshot | null>>();

  constructor(private readonly config: AppConfigService) {}

  fetchQuote(symbol: string): Promise<RestQuoteSnapshot | null> {
    const existing = this.inflight.get(symbol);
    if (existing) {
      return existing;
    }
    const request = this.requestQuote(symbol).finally(() => {
      this.inflight.delete(symbol);
    });
    this.inflight.set(symbol, request);
    return request;
  }

  private async requestQuote(symbol: string): Promise<RestQuoteSnapshot | null> {
    const base = this.config.get('FINNHUB_REST_URL').replace(/\/$/, '');
    const token = this.config.get('FINNHUB_API_KEY');
    const url = `${base}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `Finnhub REST quote failed for ${symbol}: HTTP ${response.status}`,
        );
        return null;
      }
      const body = (await response.json()) as FinnhubQuoteResponse;
      return parseQuoteResponse(body);
    } catch (error) {
      this.logger.warn(
        `Finnhub REST quote error for ${symbol}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }
}

export function parseQuoteResponse(
  body: FinnhubQuoteResponse,
): RestQuoteSnapshot | null {
  const price = asFiniteNumber(body.c);
  if (price === null || price <= 0) {
    return null;
  }
  const change = asFiniteNumber(body.d) ?? 0;
  const changePercent = asFiniteNumber(body.dp) ?? 0;
  const previousClose = asFiniteNumber(body.pc) ?? price - change;
  const timestampSec = asFiniteNumber(body.t);
  const timestampMs =
    timestampSec !== null && timestampSec > 0
      ? Math.trunc(timestampSec * 1000)
      : Date.now();

  return {
    price,
    change,
    changePercent,
    previousClose: previousClose > 0 ? previousClose : price,
    timestampMs,
  };
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

/** Shared helper so gateway/tests build string quotes the same way. */
export function restSnapshotToStrings(snapshot: RestQuoteSnapshot): {
  price: string;
  change: string;
  changePercent: string;
  previousClose: string;
  timestamp: string;
} {
  return {
    price: numberToPriceString(snapshot.price),
    change: numberToPriceString(snapshot.change),
    changePercent: numberToPriceString(snapshot.changePercent),
    previousClose: numberToPriceString(snapshot.previousClose),
    timestamp: new Date(snapshot.timestampMs).toISOString(),
  };
}
