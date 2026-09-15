import { io, type Socket } from "socket.io-client";
import type { MarketStatusEvent, QuoteDto } from "@capitalflow/shared-types";
import { MARKET_STREAM_URL } from "@/lib/env";

/**
 * Plain module-level singleton (same pattern as `lib/auth/token-store.ts`):
 * owns the single Socket.io connection to `apps/market-stream`'s `/market`
 * namespace for the whole browser tab (spec 003 section 7: "useMarketSocket
 * should own a single Socket.io client instance per browser tab, shared
 * across all live-updating components on the page"). `useMarketSocket`
 * (the React-facing hook) is a thin wrapper around this module; components
 * never talk to Socket.io directly.
 */

export type ConnectionStatus = MarketStatusEvent["status"] | "disconnected";

type QuoteListener = (quote: QuoteDto) => void;
type StatusListener = (status: ConnectionStatus) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;

/** symbol -> number of `useMarketSocket` call sites currently watching it. */
const watchCounts = new Map<string, number>();
/** symbol -> the set of component-level callbacks to notify on update. */
const quoteListeners = new Map<string, Set<QuoteListener>>();
const statusListeners = new Set<StatusListener>();
let lastStatus: ConnectionStatus = "disconnected";

function notifyStatus(status: ConnectionStatus): void {
  lastStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

function ensureSocket(token: string): Socket {
  if (socket && currentToken === token) {
    return socket;
  }

  // Token changed (or first connect ever): tear down any prior connection
  // before opening a new one. Mid-session token refresh on an already-open
  // socket is explicitly out of scope for spec 003 (section 6/9) — this
  // branch only exists so a fresh login after a full logout gets a clean
  // connection, not to support seamless silent-refresh handoff.
  if (socket) {
    socket.disconnect();
  }

  currentToken = token;
  const instance = io(`${MARKET_STREAM_URL}/market`, {
    auth: { token },
  });

  instance.on("connect", () => {
    notifyStatus("connected");
    // AC34: the server's in-memory watch state does not survive a
    // reconnect/restart, so every symbol this tab still cares about is
    // re-subscribed on every `connect` (initial connect and every
    // reconnect alike).
    for (const [symbol, count] of watchCounts) {
      if (count > 0) {
        instance.emit("subscribe", { symbol });
      }
    }
  });

  instance.on("disconnect", () => {
    notifyStatus("reconnecting");
  });

  instance.on("connect_error", () => {
    notifyStatus("reconnecting");
  });

  instance.on("market:status", (event: MarketStatusEvent) => {
    notifyStatus(event.status);
  });

  instance.on("quote:update", (quote: QuoteDto) => {
    const listeners = quoteListeners.get(quote.symbol);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(quote);
    }
  });

  socket = instance;
  return instance;
}

export function getConnectionStatus(): ConnectionStatus {
  return lastStatus;
}

/** Notifies `listener` immediately with the current status, then on every change. */
export function subscribeToStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(lastStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Registers `onUpdate` for `symbol` and increments this tab's watch count
 * for it. Mirrors the server's own refcounting (spec 003 AC2/AC3): an
 * upstream `subscribe` is only emitted the first time a symbol goes from 0
 * to 1 watchers, so sibling components sharing a symbol (e.g. the ticker
 * bar and the featured table both watch AAPL) never double-subscribe, and
 * an `unsubscribe` is only emitted once the last watcher releases it
 * (AC35) — unmounting one such component never drops the symbol out from
 * under a sibling that still needs it.
 */
export function subscribeToSymbol(
  token: string,
  symbol: string,
  onUpdate: QuoteListener,
): () => void {
  const instance = ensureSocket(token);

  let listeners = quoteListeners.get(symbol);
  if (!listeners) {
    listeners = new Set();
    quoteListeners.set(symbol, listeners);
  }
  listeners.add(onUpdate);

  const previousCount = watchCounts.get(symbol) ?? 0;
  watchCounts.set(symbol, previousCount + 1);
  if (previousCount === 0) {
    instance.emit("subscribe", { symbol });
  }

  return function unsubscribe() {
    quoteListeners.get(symbol)?.delete(onUpdate);

    const nextCount = (watchCounts.get(symbol) ?? 1) - 1;
    if (nextCount <= 0) {
      watchCounts.delete(symbol);
      quoteListeners.delete(symbol);
      instance.emit("unsubscribe", { symbol });
    } else {
      watchCounts.set(symbol, nextCount);
    }
  };
}
