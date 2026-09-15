import { isSupportedSymbol } from './supported-symbols';

describe('isSupportedSymbol (AC7)', () => {
  it('accepts configured ticker, index-proxy, and featured symbols', () => {
    expect(isSupportedSymbol('AAPL')).toBe(true);
    expect(isSupportedSymbol('SPY')).toBe(true);
    expect(isSupportedSymbol('BINANCE:BTCUSDT')).toBe(true);
  });

  it('rejects anything outside the pinned MARKET_SYMBOL_GROUPS union', () => {
    expect(isSupportedSymbol('FAKE')).toBe(false);
    expect(isSupportedSymbol('')).toBe(false);
  });
});
