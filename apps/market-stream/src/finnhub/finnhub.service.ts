import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import type { MarketStatusEvent } from '@capitalflow/shared-types';
import { nextBackoffMs } from '../market/backoff';
import {
  FINNHUB_SOCKET_FACTORY,
  type FinnhubSocketFactory,
  type FinnhubSocketLike,
} from './finnhub-socket';

type TickHandler = (symbol: string, price: number, timestampMs: number) => void;
type StatusHandler = (status: MarketStatusEvent['status']) => void;

type FinnhubTradeMessage = {
  type: string;
  data?: Array<{ s?: string; p?: number; t?: number }>;
};

/**
 * Single upstream Finnhub WebSocket for the process lifetime (AC1). Desired
 * symbol subscriptions are a synchronous set; `flushSubscriptions` is the
 * only place that talks to the socket, so a subscribe/unsubscribe race
 * (AC6) cannot leave a dangling upstream sub.
 */
@Injectable()
export class FinnhubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinnhubService.name);
  private socket: FinnhubSocketLike | null = null;
  private readonly desired = new Set<string>();
  private readonly upstream = new Set<string>();
  private connected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly tickHandlers = new Set<TickHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();

  constructor(
    private readonly config: AppConfigService,
    @Inject(FINNHUB_SOCKET_FACTORY)
    private readonly socketFactory: FinnhubSocketFactory,
  ) {}

  onModuleInit(): void {
    this.connect();
  }

  onModuleDestroy(): void {
    this.clearReconnect();
    this.socket?.close();
    this.socket = null;
  }

  onTick(handler: TickHandler): () => void {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  currentStatus(): MarketStatusEvent['status'] {
    return this.connected ? 'connected' : 'reconnecting';
  }

  setDesiredSymbols(symbols: string[]): void {
    this.desired.clear();
    for (const symbol of symbols) {
      this.desired.add(symbol);
    }
    this.flushSubscriptions();
  }

  private connect(): void {
    this.clearReconnect();
    const url = `${this.config.get('FINNHUB_WS_URL', { infer: true })}?token=${this.config.get('FINNHUB_API_KEY', { infer: true })}`;
    const socket = this.socketFactory(url);
    this.socket = socket;

    socket.on('open', () => {
      this.connected = true;
      this.reconnectAttempt = 0; // AC13: reset backoff after a stable reconnect
      this.upstream.clear();
      this.flushSubscriptions(); // AC12: restore every still-desired symbol
      this.emitStatus('connected');
      this.logger.log('Finnhub upstream connected');
    });

    socket.on('message', (payload) => {
      this.handleMessage(payload);
    });

    socket.on('close', () => {
      this.handleDisconnect();
    });

    socket.on('error', () => {
      this.handleDisconnect();
    });
  }

  private handleDisconnect(): void {
    if (!this.connected && this.reconnectTimer) {
      return;
    }
    const wasConnected = this.connected;
    this.connected = false;
    this.upstream.clear();
    this.socket = null;
    if (wasConnected) {
      this.emitStatus('reconnecting');
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const delay = nextBackoffMs(
      this.reconnectAttempt,
      this.config.get('FINNHUB_RECONNECT_BASE_MS', { infer: true }),
      this.config.get('FINNHUB_RECONNECT_MULTIPLIER', { infer: true }),
      this.config.get('FINNHUB_RECONNECT_MAX_MS', { infer: true }),
    );
    this.reconnectAttempt += 1;
    this.logger.warn(`Finnhub reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.emitStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushSubscriptions(): void {
    if (!this.connected || !this.socket) {
      return;
    }
    for (const symbol of this.desired) {
      if (!this.upstream.has(symbol)) {
        this.socket.send(JSON.stringify({ type: 'subscribe', symbol }));
        this.upstream.add(symbol);
      }
    }
    for (const symbol of [...this.upstream]) {
      if (!this.desired.has(symbol)) {
        this.socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        this.upstream.delete(symbol);
      }
    }
  }

  private handleMessage(payload: Buffer | Error | undefined): void {
    if (!payload || payload instanceof Error) {
      return;
    }
    let parsed: FinnhubTradeMessage;
    try {
      parsed = JSON.parse(payload.toString()) as FinnhubTradeMessage;
    } catch {
      return;
    }
    if (parsed.type === 'ping') {
      this.socket?.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (parsed.type !== 'trade' || !Array.isArray(parsed.data)) {
      return;
    }
    for (const trade of parsed.data) {
      if (
        typeof trade.s !== 'string' ||
        typeof trade.p !== 'number' ||
        !Number.isFinite(trade.p)
      ) {
        continue;
      }
      const timestampMs =
        typeof trade.t === 'number' && Number.isFinite(trade.t)
          ? trade.t
          : Date.now();
      for (const handler of this.tickHandlers) {
        handler(trade.s, trade.p, timestampMs);
      }
    }
  }

  private emitStatus(status: MarketStatusEvent['status']): void {
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}
