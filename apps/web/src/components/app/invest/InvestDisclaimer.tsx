/**
 * AC33 (and, at the page level, AC19): persistent, visible note stating this
 * page's entire invest flow is simulated — no real money moves, and no
 * return the calculator below shows is a promise or guarantee. Server
 * Component — pure static copy with no live values, so it renders in the
 * initial HTML with no client-side JavaScript required, mirroring
 * `PortfolioDisclaimer`. The platform-wide "Simulator mode" badge is
 * rendered separately and unconditionally by `<AppNav>` in the shared
 * `(app)/app/layout.tsx` — this note is this page's own addition on top of
 * that badge, not a replacement for it.
 */
export function InvestDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      This section is 100% simulated: none of the investments you place here
      move real money, and no result or estimate shown is a guaranteed
      return.
    </p>
  );
}
