import { TickQueue } from './tick-queue';

describe('TickQueue (AC16/AC21)', () => {
  it('AC16: discards the oldest ticks first when depth exceeds the threshold', () => {
    const queue = new TickQueue(2);
    expect(queue.enqueue({ symbol: 'AAPL', price: 1, timestampMs: 1 })).toEqual(
      [],
    );
    expect(queue.enqueue({ symbol: 'MSFT', price: 2, timestampMs: 2 })).toEqual(
      [],
    );
    const dropped = queue.enqueue({ symbol: 'NVDA', price: 3, timestampMs: 3 });
    expect(dropped).toEqual([{ symbol: 'AAPL', count: 1 }]);
    expect(queue.depth).toBe(2);
    const latest = queue.drainLatestBySymbol();
    expect(latest.get('MSFT')?.price).toBe(2);
    expect(latest.get('NVDA')?.price).toBe(3);
    expect(latest.has('AAPL')).toBe(false);
  });

  it('AC16: overflow of a single-symbol queue drops the oldest tick', () => {
    const queue = new TickQueue(1);
    queue.enqueue({ symbol: 'AAPL', price: 1, timestampMs: 1 });
    const dropped = queue.enqueue({ symbol: 'AAPL', price: 2, timestampMs: 2 });
    expect(dropped).toEqual([{ symbol: 'AAPL', count: 1 }]);
    expect(queue.drainLatestBySymbol().get('AAPL')?.price).toBe(2);
  });

  it('AC21: drainLatestBySymbol keeps the newest price per symbol', () => {
    const queue = new TickQueue(10);
    queue.enqueue({ symbol: 'AAPL', price: 10, timestampMs: 1 });
    queue.enqueue({ symbol: 'AAPL', price: 11, timestampMs: 2 });
    queue.enqueue({ symbol: 'MSFT', price: 20, timestampMs: 3 });
    const latest = queue.drainLatestBySymbol();
    expect(latest.size).toBe(2);
    expect(latest.get('AAPL')?.price).toBe(11);
    expect(latest.get('MSFT')?.price).toBe(20);
    expect(queue.depth).toBe(0);
  });
});
