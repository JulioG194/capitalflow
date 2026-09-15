import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerStorageService,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { jwtModuleFactory } from '../../config/jwt.config';
import type { EnvConfig } from '../../config/env.schema';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { InvestThrottlerGuard } from './guards/invest-throttler.guard';

@Module({
  imports: [
    // Same RS256 verification config as AuthModule (spec 002 section 7) —
    // AccessTokenGuard needs a properly configured JwtService in this
    // module's own DI graph, since AuthModule doesn't export its JwtModule.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        jwtModuleFactory(config),
    }),
  ],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    InvestThrottlerGuard,
    // Spec 005 AC14/AC15: deliberately NOT `ThrottlerModule.forRootAsync`
    // here — that dynamic module's underlying class (`ThrottlerModule`) is
    // itself decorated `@Global()`, so a second `forRootAsync` call (on top
    // of AuthModule's own, for the login throttle) would bind
    // `THROTTLER_OPTIONS`/`ThrottlerStorage` a second time on the SAME
    // global tokens, making resolution of either ambiguous app-wide
    // (verified empirically: it broke AuthModule's own rate-limit reset in
    // `auth.e2e-spec.ts`). Providing the same two tokens directly as plain,
    // non-global providers on this module keeps them strictly local to
    // `PortfolioModule`'s own container — `InvestThrottlerGuard` (declared
    // in this module) resolves them from here, and nothing outside this
    // module can observe or collide with them.
    {
      provide: getOptionsToken(),
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvConfig, true>,
      ): ThrottlerModuleOptions => [
        {
          limit: config.get('INVEST_RATE_LIMIT_MAX', { infer: true }),
          ttl:
            config.get('INVEST_RATE_LIMIT_WINDOW_SECONDS', {
              infer: true,
            }) * 1000,
        },
      ],
    },
    { provide: getStorageToken(), useClass: ThrottlerStorageService },
  ],
})
export class PortfolioModule {}
