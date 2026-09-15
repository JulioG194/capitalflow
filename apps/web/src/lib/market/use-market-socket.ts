"use client"; // opens a Socket.io connection and holds local subscription/quote state — browser-only

import { useEffect, useMemo, useState } from "react";
import type { QuoteDto } from "@capitalflow/shared-types";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAccessToken } from "@/lib/auth/token-store";
import {
  type ConnectionStatus,
  getConnectionStatus,
  subscribeToStatus,
  subscribeToSymbol,
} from "@/lib/market/market-socket-manager";

export interface UseMarketSocketResult {
  /** Latest quote per requested symbol; `undefined` until its first update arrives (AC26). */
  quotes: Record<string, QuoteDto | undefined>;
  /** Current upstream/socket connection health (AC33). */
  status: ConnectionStatus;
  /** True once the socket has connected at least once this session. */
  hasConnectedOnce: boolean;
}

/**
 * Shared client-side hook encapsulating the Socket.io connection lifecycle
 * for `/app/market` (spec 003 section 4). Reads the in-memory access token
 * from spec 002's auth context (`useAuth()`/`token-store.ts`) rather than
 * holding any token state of its own — connection is gated on
 * `isAuthenticated` so no socket is opened before a valid session exists
 * (mirrors AC18-AC20's server-side rejection of unauthenticated handshakes).
 * All actual socket/subscription bookkeeping lives in
 * `market-socket-manager.ts`, which this hook delegates to so multiple
 * components on the same page share one connection instead of opening one
 * each.
 */
export function useMarketSocket(symbols: string[]): UseMarketSocketResult {
  const { isAuthenticated } = useAuth();
  const [quotes, setQuotes] = useState<Record<string, QuoteDto | undefined>>({});
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  // Stable key so the subscription effect doesn't re-run just because a
  // caller passed a new array literal with the same symbols on every render.
  const symbolsKey = useMemo(() => [...symbols].sort().join(","), [symbols]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const activeSymbols = symbolsKey ? symbolsKey.split(",") : [];
    const unsubscribers = activeSymbols.map((symbol) =>
      subscribeToSymbol(token, symbol, (quote) => {
        setQuotes((previous) => ({ ...previous, [symbol]: quote }));
      }),
    );

    return () => {
      // AC35: releases every symbol this hook instance subscribed to
      // before unmount, so the manager's (and ultimately the server's)
      // watch count stays accurate.
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, symbolsKey]);

  useEffect(() => {
    return subscribeToStatus((next) => {
      setStatus(next);
      if (next === "connected") {
        setHasConnectedOnce(true);
      }
    });
  }, []);

  return { quotes, status, hasConnectedOnce };
}
