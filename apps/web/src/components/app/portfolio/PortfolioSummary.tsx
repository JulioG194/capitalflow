"use client"; // fetches GET /portfolio with the in-memory access token (spec 002 AC41); a Server Component can't attach it

/**
 * AC22a stub — fleshed out with real data-fetching, loading/error states,
 * and formatted values in the AC23-AC25 commit.
 */
export function PortfolioSummary() {
  return <p className="text-sm text-ink-muted">Cargando resumen…</p>;
}
