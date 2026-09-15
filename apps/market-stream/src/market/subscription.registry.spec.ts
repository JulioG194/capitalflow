import { SubscriptionRegistry } from './subscription.registry';

describe('SubscriptionRegistry (AC2–AC6)', () => {
  it('AC2: the first watcher of a symbol is reported as becameFirstWatcher', () => {
    const registry = new SubscriptionRegistry();
    expect(registry.add('c1', 'AAPL')).toEqual({ becameFirstWatcher: true });
    expect(registry.watcherCount('AAPL')).toBe(1);
  });

  it('AC3: a second watcher of the same symbol is not the first', () => {
    const registry = new SubscriptionRegistry();
    registry.add('c1', 'AAPL');
    expect(registry.add('c2', 'AAPL')).toEqual({ becameFirstWatcher: false });
    expect(registry.watcherCount('AAPL')).toBe(2);
  });

  it('AC4: removing the last watcher reports becameEmpty', () => {
    const registry = new SubscriptionRegistry();
    registry.add('c1', 'AAPL');
    registry.add('c2', 'AAPL');
    expect(registry.remove('c1', 'AAPL')).toEqual({ becameEmpty: false });
    expect(registry.remove('c2', 'AAPL')).toEqual({ becameEmpty: true });
    expect(registry.watcherCount('AAPL')).toBe(0);
    expect(registry.watchedSymbols()).toEqual([]);
  });

  it('AC5: removeAll unsubscribes every symbol the client held', () => {
    const registry = new SubscriptionRegistry();
    registry.add('c1', 'AAPL');
    registry.add('c1', 'MSFT');
    registry.add('c2', 'AAPL');
    expect(registry.removeAll('c1')).toEqual({ emptiedSymbols: ['MSFT'] });
    expect(registry.watcherCount('AAPL')).toBe(1);
    expect(registry.watcherCount('MSFT')).toBe(0);
  });

  it('AC6: subscribe then unsubscribe in the same tick leaves no watchers', () => {
    const registry = new SubscriptionRegistry();
    const { becameFirstWatcher } = registry.add('c1', 'AAPL');
    const { becameEmpty } = registry.remove('c1', 'AAPL');
    expect(becameFirstWatcher).toBe(true);
    expect(becameEmpty).toBe(true);
    expect(registry.watchedSymbols()).toEqual([]);
  });

  it('adding the same client twice for one symbol is a no-op on the set', () => {
    const registry = new SubscriptionRegistry();
    registry.add('c1', 'AAPL');
    expect(registry.add('c1', 'AAPL')).toEqual({ becameFirstWatcher: false });
    expect(registry.watcherCount('AAPL')).toBe(1);
  });
});
