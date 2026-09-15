import { describe, expect, it } from 'vitest';
import { INVESTABLE_SYMBOLS, investAmountSchema, investSchema } from './invest';

describe('investAmountSchema', () => {
  it.each(['1', '1.00', '1.5', '0.99', '10000', '10000.5', '999999.99'])(
    'accepts a well-formed positive decimal string %s (AC3)',
    (value) => {
      expect(investAmountSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    ['0', 'zero'],
    ['0.0', 'zero with one decimal'],
    ['0.00', 'zero with two decimals'],
    ['-1', 'negative'],
    ['-1.50', 'negative with decimals'],
    ['1.234', 'more than 2 decimal places'],
    ['abc', 'non-numeric'],
    ['', 'empty string'],
    ['1,50', 'comma decimal separator'],
    ['1.5.0', 'malformed decimal'],
    ['  1.50', 'leading whitespace'],
    ['1.50  ', 'trailing whitespace'],
    ['+1.50', 'leading plus sign'],
    ['Infinity', 'Infinity literal'],
    ['NaN', 'NaN literal'],
  ])('rejects %s (%s) (AC3)', (value) => {
    expect(investAmountSchema.safeParse(value).success).toBe(false);
  });
});

describe('investSchema', () => {
  it('accepts a supported symbol with a well-formed amount (AC1)', () => {
    const result = investSchema.safeParse({
      symbol: INVESTABLE_SYMBOLS[0],
      amount: '100.00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a symbol outside the investable set at the schema layer — membership (AC2) is a service-level check, not enforced by this schema', () => {
    // `investSchema`'s `symbol` field is deliberately format-only: a
    // `z.enum(INVESTABLE_SYMBOLS)` here would swallow AC2's unsupported-
    // symbol case into AC3's generic validation-error shape before
    // `PortfolioService.invest` ever runs. `PortfolioService.invest` checks
    // `INVESTABLE_SYMBOLS` membership itself and throws a distinct
    // `UnsupportedInvestSymbolException` (400 UNSUPPORTED_SYMBOL).
    const result = investSchema.safeParse({
      symbol: 'NOT_A_REAL_SYMBOL',
      amount: '100.00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty symbol (still a format check at this layer)', () => {
    const result = investSchema.safeParse({ symbol: '', amount: '100.00' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed amount even with a valid symbol (AC3)', () => {
    const result = investSchema.safeParse({
      symbol: INVESTABLE_SYMBOLS[0],
      amount: '0.00',
    });
    expect(result.success).toBe(false);
  });
});
