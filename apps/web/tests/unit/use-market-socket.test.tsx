import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { setAccessToken } from "@/lib/auth/token-store";
import { useMarketSocket } from "@/lib/market/use-market-socket";

/**
 * Spec 003 section 8: "Unit tests (Vitest, apps/web): useMarketSocket
 * subscribe-on-mount/unsubscribe-on-unmount/re-subscribe-on-reconnect
 * behavior against a mocked socket." A minimal fake Socket.io client stands
 * in for `socket.io-client`'s `io()` factory so these tests can trigger
 * `connect`/`disconnect`/`market:status`/`quote:update` events by hand and
 * assert exactly what `subscribe`/`unsubscribe` payloads were emitted.
 */

class FakeSocket {
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  emit = vi.fn();
  disconnect = vi.fn();

  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)?.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.get(event)?.delete(handler);
  }

  trigger(event: string, payload?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}

const { mockIo, createdSockets, isAuthenticatedRef } = vi.hoisted(() => {
  const createdSockets: FakeSocket[] = [];
  const mockIo = vi.fn(() => {
    const socket = new FakeSocket();
    createdSockets.push(socket);
    return socket;
  });
  const isAuthenticatedRef = { value: true };
  return { mockIo, createdSockets, isAuthenticatedRef };
});

vi.mock("socket.io-client", () => ({ io: mockIo }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: isAuthenticatedRef.value }),
}));

function latestSocket(): FakeSocket {
  const socket = createdSockets[createdSockets.length - 1];
  if (!socket) throw new Error("no socket created yet");
  return socket;
}

function Probe({ symbols }: { symbols: string[] }) {
  const { quotes, status, hasConnectedOnce } = useMarketSocket(symbols);
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="connected-once">{String(hasConnectedOnce)}</p>
      <p data-testid="aapl-price">{quotes.AAPL?.price ?? "none"}</p>
    </div>
  );
}

let tokenCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  createdSockets.length = 0;
  isAuthenticatedRef.value = true;
  // A unique token per test forces `market-socket-manager`'s singleton
  // `ensureSocket` to open a brand-new fake socket each time (its "reuse
  // the existing connection" branch only applies when the token is
  // unchanged), so each test observes its own connection.
  tokenCounter += 1;
  setAccessToken(`test-access-token-${tokenCounter}`);
});

afterEach(() => {
  cleanup();
  setAccessToken(null);
});

describe("useMarketSocket", () => {
  it("does not open a connection until the user is authenticated", () => {
    isAuthenticatedRef.value = false;
    render(<Probe symbols={["AAPL"]} />);
    expect(mockIo).not.toHaveBeenCalled();
  });

  it("subscribes to every requested symbol on mount", () => {
    render(<Probe symbols={["AAPL", "MSFT"]} />);
    const socket = latestSocket();
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { symbol: "AAPL" });
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { symbol: "MSFT" });
  });

  it("updates the matching symbol's quote when quote:update arrives (AC28)", async () => {
    render(<Probe symbols={["AAPL"]} />);
    const socket = latestSocket();

    act(() => {
      socket.trigger("quote:update", {
        symbol: "AAPL",
        price: "189.50",
        change: "1.00",
        changePercent: "1.00",
        timestamp: new Date().toISOString(),
        delayed: true,
        delayMinutes: 15,
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId("aapl-price")).toHaveTextContent("189.50"),
    );
  });

  it("unsubscribes on unmount (AC35)", () => {
    const { unmount } = render(<Probe symbols={["AAPL"]} />);
    const socket = latestSocket();
    unmount();
    expect(socket.emit).toHaveBeenCalledWith("unsubscribe", { symbol: "AAPL" });
  });

  it("does not unsubscribe a symbol still watched by a sibling component (AC35)", () => {
    const first = render(<Probe symbols={["AAPL"]} />);
    render(<Probe symbols={["AAPL"]} />);
    const socket = latestSocket();

    // Only one upstream subscribe for AAPL despite two consumers (mirrors
    // the server's own refcounting, AC2/AC3, on the client side).
    const subscribeCalls = socket.emit.mock.calls.filter(
      ([event, payload]) =>
        event === "subscribe" && (payload as { symbol: string }).symbol === "AAPL",
    );
    expect(subscribeCalls).toHaveLength(1);

    first.unmount();
    expect(socket.emit).not.toHaveBeenCalledWith("unsubscribe", { symbol: "AAPL" });
  });

  it("re-subscribes every currently-watched symbol on reconnect (AC34)", () => {
    render(<Probe symbols={["AAPL", "MSFT"]} />);
    const socket = latestSocket();
    socket.emit.mockClear();

    // Simulate the server restarting and the client reconnecting.
    act(() => {
      socket.trigger("connect");
    });

    expect(socket.emit).toHaveBeenCalledWith("subscribe", { symbol: "AAPL" });
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { symbol: "MSFT" });
  });

  it("reflects market:status and native disconnect/connect events (AC33)", async () => {
    render(<Probe symbols={["AAPL"]} />);
    const socket = latestSocket();

    act(() => {
      socket.trigger("market:status", { status: "degraded" });
    });
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("degraded"),
    );

    act(() => {
      socket.trigger("disconnect");
    });
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("reconnecting"),
    );

    act(() => {
      socket.trigger("connect");
    });
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("connected"),
    );
    expect(screen.getByTestId("connected-once")).toHaveTextContent("true");
  });
});
