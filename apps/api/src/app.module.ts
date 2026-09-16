import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { HealthModule } from './modules/health/health.module';
import { LoggingModule } from './common/logging/logging.module';
import { RequestIdMiddleware } from './common/logging/request-id.middleware';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';

@Module({
  imports: [
    LoggingModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    PortfolioModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  /**
   * Spec 006 AC33/AC34: `RequestIdMiddleware` must run before
   * `RequestLoggingMiddleware` (and before every guard/controller) so the
   * whole request pipeline — including the `finish` listener the logging
   * middleware registers — executes inside that request's
   * `AsyncLocalStorage` scope.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
