export type QueuedTick = {
  symbol: string;
  price: number;
  timestampMs: number;
};

export type DroppedTicks = {
  symbol: string;
  count: number;
};

/**
 * Bounded outbound tick queue (spec 003 AC16). Push is O(1); overflow
 * discards from the front (oldest first) until the depth is at or under
 * `maxDepth`. Callers log the resulting drop summary at `warn` (AC17).
 */
export class TickQueue {
  private readonly items: QueuedTick[] = [];

  constructor(private readonly maxDepth: number) {}

  get depth(): number {
    return this.items.length;
  }

  enqueue(tick: QueuedTick): DroppedTicks[] {
    this.items.push(tick);
    if (this.items.length <= this.maxDepth) {
      return [];
    }
    const overflow = this.items.length - this.maxDepth;
    const dropped = this.items.splice(0, overflow);
    const counts = new Map<string, number>();
    for (const tickDropped of dropped) {
      counts.set(tickDropped.symbol, (counts.get(tickDropped.symbol) ?? 0) + 1);
    }
    return [...counts.entries()].map(([symbol, count]) => ({ symbol, count }));
  }

  /**
   * Removes every queued tick and returns the most recent one per symbol
   * (AC21: when coalescing a 1-second window, keep the newest price).
   */
  drainLatestBySymbol(): Map<string, QueuedTick> {
    const latest = new Map<string, QueuedTick>();
    for (const tick of this.items) {
      latest.set(tick.symbol, tick);
    }
    this.items.length = 0;
    return latest;
  }
}
