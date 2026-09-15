/**
 * Formats a Decimal-string monetary value for display as USD, e.g.
 *   formatMoney("10000")      -> "$10,000.00"
 *   formatMoney("-42.1")      -> "-$42.10"
 *   formatMoney("0")          -> "$0.00"
 *   formatMoney("1234.567")   -> "$1,234.57" (rounded half-up, display only)
 *   formatMoney("abc")        -> "$0.00" (malformed input falls back, never throws)
 *
 * Deliberately does NOT use Intl.NumberFormat: locale-dependent currency
 * glyph/placement is not guaranteed stable across Node/browser versions,
 * which would make output non-deterministic and untestable. Any numeric
 * conversion inside this function exists solely to produce the final
 * rounded-to-2-decimals display string — never for further computation —
 * and is the one sanctioned exception to CLAUDE.md's "never JS number for
 * money" rule. Every other layer (DB, API responses, component props,
 * arithmetic) continues to use Decimal/string only.
 */
export function formatMoney(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '$0.00';
  }

  const negative = num < 0;
  const rounded = Math.round(Math.abs(num) * 100) / 100;
  const [wholePart, decimalPart] = rounded.toFixed(2).split('.') as [string, string];
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${negative ? '-' : ''}$${grouped}.${decimalPart}`;
}
