export type Sign = "negative" | "zero" | "positive";

/**
 * Classifies a signed decimal-string field (e.g. `totalProfit`, `roiPercent`,
 * `unrealizedProfit`/`unrealizedProfitPercent`) as negative/zero/positive
 * purely by inspecting its string form — never via `Number()`/`parseFloat()`
 * (AC30 applies to every string field rendered on this page, not only
 * `formatMoney`-formatted ones). These fields are always emitted by the API
 * with a leading `-` for negative values and no leading sign otherwise (spec
 * 004 AC8), so a string-level check is sufficient and exact.
 */
export function classifySign(value: string): Sign {
  const trimmed = value.trim();
  if (trimmed.startsWith("-")) {
    return /^-0+(\.0+)?$/.test(trimmed) ? "zero" : "negative";
  }
  return /^0+(\.0+)?$/.test(trimmed) ? "zero" : "positive";
}
