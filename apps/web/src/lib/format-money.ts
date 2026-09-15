/**
 * Formats an opaque monetary string for display. CLAUDE.md: "Never parse
 * strings as `number` and re-stringify — treat monetary strings as opaque
 * values until display." This util parses only transiently, to feed
 * `Intl.NumberFormat`, and the formatted result is a display string only —
 * it is never fed back into a request payload, stored, or compared for
 * business logic. Callers (market quote cards/tables) always keep the
 * original `QuoteDto.price`/`change` strings as the source of truth.
 */
export function formatMoney(value: string, currency = "USD"): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}
