import {
  MARKET_DATA_DELAY_MINUTES,
  type QuoteDto,
} from '@capitalflow/shared-types';

/**
 * Converts a Finnhub numeric price into a decimal string at the process
 * boundary. Numeric conversion exists only here (and in `diffFromBaseline`
 * below) so Redis and Socket.io payloads never carry a JS `number`.
 */
export function numberToPriceString(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  const fixed = value.toFixed(6);
  const [whole, frac = '00'] = fixed.split('.') as [string, string];
  const trimmed = frac.replace(/0+$/, '');
  const decimals = trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed;
  return `${whole}.${decimals}`;
}

export function diffFromBaseline(
  price: string,
  baseline: string,
): { change: string; changePercent: string } {
  const current = Number(price);
  const reference = Number(baseline);
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(reference) ||
    reference === 0
  ) {
    return { change: '0.00', changePercent: '0.00' };
  }
  const change = current - reference;
  const changePercent = (change / reference) * 100;
  return {
    change: numberToPriceString(change),
    changePercent: numberToPriceString(changePercent),
  };
}

export function toQuoteDto(input: {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  timestamp?: string;
  stale?: boolean;
}): QuoteDto {
  const quote: QuoteDto = {
    symbol: input.symbol,
    price: input.price,
    change: input.change,
    changePercent: input.changePercent,
    timestamp: input.timestamp ?? new Date().toISOString(),
    delayed: true,
    delayMinutes: MARKET_DATA_DELAY_MINUTES,
  };
  if (input.stale !== undefined) {
    quote.stale = input.stale;
  }
  return quote;
}
