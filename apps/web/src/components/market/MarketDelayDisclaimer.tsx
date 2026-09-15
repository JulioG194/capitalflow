import { MARKET_DATA_DELAY_MINUTES } from "@capitalflow/shared-types";

/**
 * AC24: persistent, visible label stating the market data is delayed and
 * provided for educational/simulated purposes only. Server Component — pure
 * static copy with no live values, so it renders in the initial HTML with
 * no client-side JavaScript required (AC25). The platform-wide "Modo
 * Simulador" badge is rendered separately and unconditionally by
 * `<AppNav>` (`components/app/AppNav.tsx`) in the shared `(app)/app/layout.tsx`.
 */
export function MarketDelayDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Los precios se muestran con un retraso de {MARKET_DATA_DELAY_MINUTES}{" "}
      minutos y tienen fines educativos y de simulación. No representan
      operaciones reales de mercado.
    </p>
  );
}
