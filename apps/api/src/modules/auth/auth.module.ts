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
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConsoleEmailAdapter, EmailService } from './email/email.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        jwtModuleFactory(config),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // AC34/AC35: the only place that wires a concrete EmailService — a
    // future real provider adapter (spec 006) only changes this line.
    { provide: EmailService, useClass: ConsoleEmailAdapter },
    // AC30/AC31: `ThrottlerGuard` is applied as a method-level guard on
    // POST /auth/login only (see auth.controller.ts) — the spec scopes
    // rate limiting "specifically to POST /auth/login", not every route.
    //
    // Deliberately NOT `ThrottlerModule.forRootAsync` here: that dynamic
    // module's underlying class (`ThrottlerModule`) is itself decorated
    // `@Global()`, so once a second, unrelated feature (spec 005's invest
    // rate limit, PortfolioModule) also needed its own distinct
    // `ThrottlerGuard`-based limiter, a second `forRootAsync` call bound
    // `THROTTLER_OPTIONS`/`ThrottlerStorage` a second time on the SAME
    // global tokens, making resolution of either ambiguous app-wide
    // (verified empirically: it broke this module's own rate-limit-reset
    // test in `auth.e2e-spec.ts`). Providing the same two tokens directly
    // as plain, non-global providers keeps them strictly local to this
    // module's own container, mirroring `PortfolioModule`'s identical fix.
    {
      provide: getOptionsToken(),
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvConfig, true>,
      ): ThrottlerModuleOptions => [
        {
          limit: config.get('LOGIN_RATE_LIMIT_MAX', { infer: true }),
          ttl:
            config.get('LOGIN_RATE_LIMIT_WINDOW_SECONDS', {
              infer: true,
            }) * 1000,
        },
      ],
    },
    { provide: getStorageToken(), useClass: ThrottlerStorageService },
  ],
})
export class AuthModule {}
