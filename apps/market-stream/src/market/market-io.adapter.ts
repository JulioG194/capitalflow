import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { AppConfigService } from '../config/app-config.service';
import { buildMarketCorsOptions } from './market-cors';

/**
 * `createIOServer`'s actual runtime options: Nest's own `IoAdapter#create`
 * destructures `namespace`/`server` off the gateway-decorator options
 * before forwarding the rest here (see `@nestjs/platform-socket.io`'s
 * `io-adapter.js`), and every field is optional in practice since
 * `@WebSocketGateway(...)`'s own argument is optional — hence `Partial`
 * rather than socket.io's own `ServerOptions`, whose interface declares
 * several fields as required.
 */
type IoServerOptions = Partial<ServerOptions> & {
  namespace?: string;
  server?: unknown;
};

/**
 * Custom Socket.io adapter (spec 006 AC10) — replaces the static
 * `@WebSocketGateway({ cors })` decorator argument, which is evaluated at
 * module-import time before Nest's DI container (and therefore the
 * Zod-validated `AppConfigService`) exists, so it can never read live
 * config. This adapter is constructed with a reference to the
 * already-bootstrapped Nest application (`new MarketIoAdapter(app)`, the
 * standard Nest pattern — see `main.ts`), so `createIOServer` can call
 * `this.appContext.get(AppConfigService)` and build CORS options from
 * fully-validated config instead of raw `process.env`.
 *
 * Deliberately does NOT mutate `server.engine.opts.cors` from the
 * gateway's `afterInit` hook — that alternative was considered and
 * rejected in favor of this adapter, which sets `cors` before the
 * Socket.io server is even constructed.
 */
export class MarketIoAdapter extends IoAdapter {
  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  createIOServer(port: number, options?: IoServerOptions): unknown {
    const config = this.appContext.get(AppConfigService);
    const cors = buildMarketCorsOptions({
      webAppOrigin: config.get('WEB_APP_ORIGIN'),
      webPreviewOriginRegex: config.get('WEB_PREVIEW_ORIGIN_REGEX'),
    });

    // `cors` is spread last so it always wins over whatever the
    // `@WebSocketGateway` decorator's own (now-vestigial) `cors` option
    // contributed to `options` — see `market.gateway.ts`.
    return super.createIOServer(port, { ...options, cors });
  }
}
