"use client"; // shows live socket connection / reconnect state (spec 003 AC33)

import { useEffect, useState } from "react";
import {
  getConnectionStatus,
  subscribeToStatus,
  type ConnectionStatus,
} from "@/lib/market/market-socket-manager";

function bannerCopy(status: ConnectionStatus): string | null {
  if (status === "connected") return null;
  if (status === "degraded") {
    return "Upstream market data may be delayed — showing last known prices.";
  }
  return "Connecting to market data…";
}

/**
 * Spec 003 AC33 / spec 006 AC24: visible reconnecting indicator instead of
 * silently freezing stale numbers when the Socket.io connection drops.
 */
export function MarketConnectionBanner() {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());

  useEffect(() => subscribeToStatus(setStatus), []);

  const message = bannerCopy(status);
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-card border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950"
    >
      {message}
    </div>
  );
}
