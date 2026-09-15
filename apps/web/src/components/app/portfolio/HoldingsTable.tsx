"use client"; // fetches GET /portfolio/holdings with the in-memory access token (spec 002 AC41); a Server Component can't attach it

/**
 * AC22a stub — fleshed out with the real holdings table in the AC27 commit.
 */
export function HoldingsTable() {
  return <p className="text-sm text-ink-muted">Cargando posiciones…</p>;
}
