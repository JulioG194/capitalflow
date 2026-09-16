import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, AppConfigService } from './config/app-config.service';
import { HealthController } from './health.controller';
import { SocketAuthService } from './auth/socket-auth.service';
import { QuoteCacheService } from './redis/quote-cache.service';
import { SubscriptionRegistry } from './market/subscription.registry';
import { FanoutService } from './market/fanout.service';
import { MarketGateway } from './market/market.gateway';
import { FinnhubService } from './finnhub/finnhub.service';
import { FinnhubQuoteClient } from './finnhub/finnhub-quote.client';
import { FINNHUB_SOCKET_FACTORY } from './finnhub/finnhub-socket';
import { createFinnhubWebSocket } from './finnhub/finnhub-ws';
import { LoggingModule } from './logging/logging.module';
import { RequestIdMiddleware } from './logging/request-id.middleware';

@Module({
  imports: [
    LoggingModule,
    AppConfigModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        publicKey: config.get('JWT_ACCESS_PUBLIC_KEY'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    SocketAuthService,
    QuoteCacheService,
    SubscriptionRegistry,
    FanoutService,
    FinnhubService,
    FinnhubQuoteClient,
    MarketGateway,
    {
      provide: FINNHUB_SOCKET_FACTORY,
      useValue: createFinnhubWebSocket,
    },
  ],
})
export class AppModule implements NestModule {
  /** Spec 006 AC33: every HTTP request runs inside a requestId AsyncLocalStorage scope. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
