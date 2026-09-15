import { Injectable } from '@nestjs/common';

/**
 * In-memory watch-count bookkeeping (spec 003 AC2–AC6). A single
 * `symbol -> Set<clientId>` map is the source of truth; all mutations are
 * synchronous so a subscribe immediately followed by an unsubscribe in the
 * same tick cannot leave a dangling upstream subscription (AC6).
 */
@Injectable()
export class SubscriptionRegistry {
  private readonly watchers = new Map<string, Set<string>>();
  private readonly clientSymbols = new Map<string, Set<string>>();

  add(
    clientId: string,
    symbol: string,
  ): { becameFirstWatcher: boolean } {
    let clients = this.watchers.get(symbol);
    if (!clients) {
      clients = new Set();
      this.watchers.set(symbol, clients);
    }
    const becameFirstWatcher = clients.size === 0;
    clients.add(clientId);

    let symbols = this.clientSymbols.get(clientId);
    if (!symbols) {
      symbols = new Set();
      this.clientSymbols.set(clientId, symbols);
    }
    symbols.add(symbol);

    return { becameFirstWatcher };
  }

  remove(
    clientId: string,
    symbol: string,
  ): { becameEmpty: boolean } {
    const clients = this.watchers.get(symbol);
    if (!clients || !clients.has(clientId)) {
      return { becameEmpty: false };
    }
    clients.delete(clientId);
    if (clients.size === 0) {
      this.watchers.delete(symbol);
    }

    const symbols = this.clientSymbols.get(clientId);
    symbols?.delete(symbol);
    if (symbols && symbols.size === 0) {
      this.clientSymbols.delete(clientId);
    }

    return { becameEmpty: clients.size === 0 };
  }

  /** AC5: treat disconnect as unsubscribe for every symbol the client held. */
  removeAll(clientId: string): { emptiedSymbols: string[] } {
    const symbols = [...(this.clientSymbols.get(clientId) ?? [])];
    const emptiedSymbols: string[] = [];
    for (const symbol of symbols) {
      const { becameEmpty } = this.remove(clientId, symbol);
      if (becameEmpty) {
        emptiedSymbols.push(symbol);
      }
    }
    return { emptiedSymbols };
  }

  watchedSymbols(): string[] {
    return [...this.watchers.keys()];
  }

  watcherCount(symbol: string): number {
    return this.watchers.get(symbol)?.size ?? 0;
  }

  isWatching(clientId: string, symbol: string): boolean {
    return this.watchers.get(symbol)?.has(clientId) ?? false;
  }
}
