/**
 * Formats an opaque `QuoteDto.changePercent` string (e.g. "-1.2345") for
 * display, following the same "parse only to render, never to re-store"
 * rule as `formatMoney` (CLAUDE.md).
 */
export function formatChangePercent(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}%`;
}

/**
 * Classifies an opaque `QuoteDto.change`/`changePercent` string for
 * up/down/flat styling (e.g. green vs. red text), without ever converting
 * the value back into a number used anywhere but this one display decision.
 */
export function getChangeDirection(value: string): "up" | "down" | "flat" {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "flat";
  }
  return numeric > 0 ? "up" : "down";
}

/**
 * Formats a `QuoteDto.timestamp` (ISO 8601) as a locale time-of-day string,
 * used by the featured table's "last updated" column (AC32).
 */
export function formatUpdatedAt(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
