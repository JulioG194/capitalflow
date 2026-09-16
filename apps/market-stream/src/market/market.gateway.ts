import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { DefaultEventsMap } from 'socket.io';
import { Server, Socket } from 'socket.io';
import {
  subscribePayloadSchema,
  type MarketErrorEvent,
  type QuoteDto,
} from '@capitalflow/shared-types';
import {
  SocketAuthService,
  type AccessTokenPayload,
} from '../auth/socket-auth.service';
import { FinnhubService } from '../finnhub/finnhub.service';
import {
  FinnhubQuoteClient,
  restSnapshotToStrings,
} from '../finnhub/finnhub-quote.client';
import { QuoteCacheService } from '../redis/quote-cache.service';
import { FanoutService } from './fanout.service';
import { SubscriptionRegistry } from './subscription.registry';
import { isSupportedSymbol } from './supported-symbols';
import { toQuoteDto } from './quote.util';

function symbolRoom(symbol: string): string {
  return `symbol:${symbol}`;
}

/**
 * Handshake-set socket data (see `afterInit` below) — typing this here,
 * rather than leaving `Socket`'s default `SocketData = any`, is what lets
 * `socket.data.user = payload` type-check without an unsafe member access.
 */
type MarketSocketData = { user: AccessTokenPayload };
type MarketServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  MarketSocketData
>;

/**
 * Socket.io `/market` namespace (spec 003 section 4). Auth is handshake-only
 * (AC18–AC20); subscribe/unsubscribe drive the in-memory watch counts and
 * the single Finnhub upstream connection.
 */
@WebSocketGateway({
  namespace: '/market',
  cors: { origin: true, credentials: true },
})
export class MarketGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: MarketServer;

  private readonly logger = new Logger(MarketGateway.name);
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    private readonly auth: SocketAuthService,
    private readonly registry: SubscriptionRegistry,
    private readonly fanout: FanoutService,
    private readonly cache: QuoteCacheService,
    private readonly finnhub: FinnhubService,
    private readonly quotes: FinnhubQuoteClient,
  ) {}

  onModuleInit(): void {
    this.fanout.setPublisher((symbol, quote) => {
      this.server?.to(symbolRoom(symbol)).emit('quote:update', quote);
    });
    this.unsubscribers.push(
      this.finnhub.onTick((symbol, price, timestampMs) => {
        this.fanout.ingestTick(symbol, price, timestampMs);
      }),
    );
    this.unsubscribers.push(
      this.finnhub.onStatus((status) => {
        this.server?.emit('market:status', { status });
      }),
    );
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
  }

  afterInit(server: MarketServer): void {
    server.use((socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      const payload = this.auth.verifyHandshakeToken(token);
      if (!payload) {
        // AC19/AC20: identical reject path, no distinguishing detail.
        next(new Error('UNAUTHORIZED'));
        return;
      }
      socket.data.user = payload;
      next();
    });
  }

  handleConnection(client: Socket): void {
    client.emit('market:status', { status: this.finnhub.currentStatus() });
  }

  handleDisconnect(client: Socket): void {
    const { emptiedSymbols } = this.registry.removeAll(client.id);
    for (const symbol of emptiedSymbols) {
      void client.leave(symbolRoom(symbol));
    }
    this.syncUpstream();
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = subscribePayloadSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(client, {
        code: 'SUBSCRIBE_FAILED',
        message: 'Invalid subscribe payload',
      });
      return;
    }
    const { symbol } = parsed.data;
    if (!isSupportedSymbol(symbol)) {
      this.emitError(client, {
        code: 'UNSUPPORTED_SYMBOL',
        symbol,
        message: `Symbol ${symbol} is not supported`,
      });
      return;
    }

    const { becameFirstWatcher } = this.registry.add(client.id, symbol);
    await client.join(symbolRoom(symbol));
    if (becameFirstWatcher) {
      this.syncUpstream();
    }
    await this.emitCachedQuote(client, symbol);
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = subscribePayloadSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(client, {
        code: 'SUBSCRIBE_FAILED',
        message: 'Invalid unsubscribe payload',
      });
      return;
    }
    const { symbol } = parsed.data;
    const { becameEmpty } = this.registry.remove(client.id, symbol);
    await client.leave(symbolRoom(symbol));
    if (becameEmpty) {
      this.syncUpstream();
    }
  }

  private syncUpstream(): void {
    this.finnhub.setDesiredSymbols(this.registry.watchedSymbols());
  }

  private async emitCachedQuote(client: Socket, symbol: string): Promise<void> {
    const cached = await this.cache.readQuote(symbol);
    if (cached) {
      const quote: QuoteDto = toQuoteDto({
        symbol,
        price: cached.price,
        change: cached.change ?? '0.00',
        changePercent: cached.changePercent ?? '0.00',
        timestamp: cached.timestamp,
        stale: false,
      });
      client.emit('quote:update', quote);
      return;
    }

    // AC10: cache miss → one-shot Finnhub REST /quote bootstrap.
    const snapshot = await this.quotes.fetchQuote(symbol);
    if (!snapshot) {
      return;
    }
    const strings = restSnapshotToStrings(snapshot);
    const quote = toQuoteDto({
      symbol,
      price: strings.price,
      change: strings.change,
      changePercent: strings.changePercent,
      timestamp: strings.timestamp,
      stale: false,
    });
    this.fanout.seedQuote(quote, strings.previousClose);
    client.emit('quote:update', quote);
  }

  private emitError(client: Socket, error: MarketErrorEvent): void {
    this.logger.debug(`market:error ${error.code} ${error.symbol ?? ''}`);
    client.emit('market:error', error);
  }
}
