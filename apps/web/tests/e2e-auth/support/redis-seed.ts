import net from "node:net";

/**
 * Minimal RESP (Redis Serialization Protocol) client used only to seed/clear
 * a `market:quote:<symbol>` cache entry for spec 005's invest e2e flow — the
 * exact same key `apps/api`'s `PortfolioService.invest` reads (spec 004
 * section 4's pricing contract). This avoids depending on `apps/market-stream`
 * actually being up and subscribed to a symbol (spec 005 section 6: proactive
 * cache-warming is explicitly out of scope for the product itself), and
 * avoids adding a new runtime dependency (e.g. `ioredis`) to `apps/web` for a
 * test-only concern — a bare `net.Socket` speaking RESP directly against the
 * same local dev Redis `apps/api/.env`'s `REDIS_URL` already points at is
 * enough for a single `SET`/`DEL`.
 */

const REDIS_HOST = "localhost";
const REDIS_PORT = 6379;

function encodeCommand(args: string[]): Buffer {
  const parts: (string | Buffer)[] = [`*${args.length}\r\n`];
  for (const arg of args) {
    const buf = Buffer.from(arg, "utf-8");
    parts.push(`$${buf.length}\r\n`, buf, "\r\n");
  }
  return Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, "utf-8"))));
}

function sendCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: REDIS_HOST, port: REDIS_PORT });
    let reply = "";

    socket.once("connect", () => {
      socket.write(encodeCommand(args));
    });
    socket.on("data", (chunk) => {
      reply += chunk.toString("utf-8");
      socket.end();
    });
    socket.on("close", () => resolve(reply));
    socket.on("error", reject);
  });
}

/**
 * Seeds `market:quote:<symbol>` with a fresh price (default 120s TTL, well
 * above this test's own timeout) in the exact `{"price": "..."}` JSON shape
 * `PortfolioService.invest`'s `parseCachedPrice` expects.
 */
export async function seedQuote(symbol: string, price: string, ttlSeconds = 120): Promise<void> {
  const reply = await sendCommand([
    "SET",
    `market:quote:${symbol}`,
    JSON.stringify({ price }),
    "EX",
    String(ttlSeconds),
  ]);
  if (!reply.startsWith("+OK")) {
    throw new Error(`Failed to seed market:quote:${symbol} in Redis: ${reply}`);
  }
}

/** Best-effort cleanup so a seeded test price never outlives this suite's run. */
export async function clearQuote(symbol: string): Promise<void> {
  await sendCommand(["DEL", `market:quote:${symbol}`]).catch(() => undefined);
}
