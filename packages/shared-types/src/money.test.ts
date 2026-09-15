import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats whole and pre-rounded values (AC32)', () => {
    expect(formatMoney('10000')).toBe('$10,000.00');
    expect(formatMoney('10000.00')).toBe('$10,000.00');
  });

  it('formats negative values with the sign before the currency symbol (AC33)', () => {
    expect(formatMoney('-42.1')).toBe('-$42.10');
  });

  it('formats zero (AC34)', () => {
    expect(formatMoney('0')).toBe('$0.00');
    expect(formatMoney('0.00')).toBe('$0.00');
  });

  it('rounds half-up to 2 decimals for display only (AC35)', () => {
    expect(formatMoney('1234.567')).toBe('$1,234.57');
  });

  it('falls back to $0.00 for malformed input instead of throwing (AC36)', () => {
    expect(formatMoney('')).toBe('$0.00');
    expect(formatMoney('abc')).toBe('$0.00');
    expect(formatMoney('NaN')).toBe('$0.00');
  });

  it('groups thousands correctly for larger values', () => {
    expect(formatMoney('1234567.5')).toBe('$1,234,567.50');
  });
});
