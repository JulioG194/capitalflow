import { INVESTABLE_SYMBOLS } from '@capitalflow/shared-types';

const SUPPORTED = new Set<string>(INVESTABLE_SYMBOLS);

export function isSupportedSymbol(symbol: string): boolean {
  return SUPPORTED.has(symbol);
}
