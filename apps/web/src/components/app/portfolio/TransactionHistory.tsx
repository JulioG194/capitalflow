"use client"; // fetches GET /portfolio/transactions with the in-memory access token (spec 002 AC41) and holds pagination state; a Server Component can't attach the token or hold interactive state

/**
 * AC22a stub — fleshed out with the real transaction table + pagination in
 * the AC28/AC29 commit.
 */
export function TransactionHistory() {
  return <p className="text-sm text-ink-muted">Cargando transacciones…</p>;
}
