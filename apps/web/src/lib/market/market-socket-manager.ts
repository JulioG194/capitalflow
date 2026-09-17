import { io, type Socket } from "socket.io-client";
import type {
  ChartHistoryEvent,
  MarketStatusEvent,
  QuoteDto,
} from "@capitalflow/shared-types";
import { MARKET_STREAM_URL } from "@/lib/env";

/**
 * Plain module-level singleton (same pattern as `lib/auth/token-store.ts`):
 * owns the single Socket.io connection to `apps/market-stream`'s `/market`
 * namespace for the whole browser tab (spec 003 section 7).
 */

export type ConnectionStatus = MarketStatusEvent["status"] | "disconnected";

type QuoteListener = (quote: QuoteDto) => void;
type StatusListener = (status: ConnectionStatus) => void;
type HistoryListener = (history: ChartHistoryEvent) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;

/** symbol -> number of `useMarketSocket` call sites currently watching it. */
const watchCounts = new Map<string, number>();
/** symbol -> the set of component-level callbacks to notify on update. */
const quoteListeners = new Map<string, Set<QuoteListener>>();
const historyListeners = new Map<string, Set<HistoryListener>>();
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

  if (socket) {
    socket.disconnect();
  }

  currentToken = token;
  const instance = io(`${MARKET_STREAM_URL}/market`, {
    auth: { token },
  });

  instance.on("connect", () => {
    notifyStatus("connected");
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

  instance.on("chart:history", (event: ChartHistoryEvent) => {
    const listeners = historyListeners.get(event.symbol);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  });

  socket = instance;
  return instance;
}

export function getConnectionStatus(): ConnectionStatus {
  return lastStatus;
}

export function subscribeToStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(lastStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Registers a chart-history listener for `symbol`. Does not change watch
 * counts — pair with `subscribeToSymbol` (or `useMarketSocket`) so the
 * server actually emits `chart:history` after `subscribe`.
 */
export function subscribeToHistory(
  token: string,
  symbol: string,
  onHistory: HistoryListener,
): () => void {
  ensureSocket(token);
  let listeners = historyListeners.get(symbol);
  if (!listeners) {
    listeners = new Set();
    historyListeners.set(symbol, listeners);
  }
  listeners.add(onHistory);
  return () => {
    historyListeners.get(symbol)?.delete(onHistory);
    if ((historyListeners.get(symbol)?.size ?? 0) === 0) {
      historyListeners.delete(symbol);
    }
  };
}

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
