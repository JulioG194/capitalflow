import { MARKET_DATA_DELAY_MINUTES } from '@capitalflow/shared-types';
import { diffFromBaseline, numberToPriceString, toQuoteDto } from './quote.util';

describe('quote.util (AC23)', () => {
  it('formats finite prices as decimal strings, never returning a number', () => {
    expect(numberToPriceString(189.5)).toBe('189.50');
    expect(numberToPriceString(1.23456789)).toBe('1.234568');
    expect(typeof numberToPriceString(10)).toBe('string');
  });

  it('computes change and changePercent as strings against a baseline', () => {
    expect(diffFromBaseline('110.00', '100.00')).toEqual({
      change: '10.00',
      changePercent: '10.00',
    });
  });

  it('AC23: every QuoteDto is delayed 15 minutes with string money fields', () => {
    const quote = toQuoteDto({
      symbol: 'AAPL',
      price: '189.50',
      change: '1.20',
      changePercent: '0.64',
    });
    expect(quote.delayed).toBe(true);
    expect(quote.delayMinutes).toBe(MARKET_DATA_DELAY_MINUTES);
    expect(typeof quote.price).toBe('string');
    expect(typeof quote.change).toBe('string');
    expect(typeof quote.changePercent).toBe('string');
  });
});
