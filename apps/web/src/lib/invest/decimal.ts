/**
 * Exact, allocation-free comparison between two non-negative decimal
 * strings (e.g. an entered invest `amount` and the fetched `cashBalance`) —
 * used by `<InvestForm>`'s "amount exceeds balance" UX guard (spec 005
 * AC24). Deliberately avoids `Number()`/`parseFloat()` on either monetary
 * string (AC32) by scaling both values to matching-precision integers via
 * `BigInt` instead of converting through a floating-point `number`.
 */

function fractionalLength(value: string): number {
  const dotIndex = value.indexOf(".");
  return dotIndex === -1 ? 0 : value.length - dotIndex - 1;
}

function toScaledBigInt(value: string, scale: number): bigint {
  const negative = value.trim().startsWith("-");
  const unsigned = negative ? value.trim().slice(1) : value.trim();
  const [wholeRaw, fractionalRaw = ""] = unsigned.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const fractional = `${fractionalRaw}${"0".repeat(scale)}`.slice(0, scale);
  const magnitude = BigInt(`${whole}${fractional}`);
  return negative ? -magnitude : magnitude;
}

/** Returns -1 if `a < b`, 0 if equal, 1 if `a > b`. Both must be well-formed decimal strings. */
export function compareDecimalStrings(a: string, b: string): number {
  const scale = Math.max(fractionalLength(a), fractionalLength(b));
  const scaledA = toScaledBigInt(a, scale);
  const scaledB = toScaledBigInt(b, scale);
  if (scaledA < scaledB) return -1;
  if (scaledA > scaledB) return 1;
  return 0;
}
