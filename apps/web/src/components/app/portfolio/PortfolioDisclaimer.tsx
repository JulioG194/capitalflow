/**
 * AC22: persistent, visible note stating every figure on this page is
 * simulated. Server Component — pure static copy with no live values, so it
 * renders in the initial HTML with no client-side JavaScript required. The
 * platform-wide "Simulator mode" badge is rendered separately and
 * unconditionally by `<AppNav>` (`components/app/AppNav.tsx`) in the shared
 * `(app)/app/layout.tsx` — this note is this page's own addition on top of
 * that badge, not a replacement for it.
 */
export function PortfolioDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Every figure on this page is simulated: balances, returns, holdings,
      and transactions do not represent real money.
    </p>
  );
}
