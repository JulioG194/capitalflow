import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
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
    // AC30/AC31: registered only here, not globally via APP_GUARD in
    // AppModule — the spec scopes rate limiting "specifically to
    // POST /auth/login", not every route. `ThrottlerGuard` is applied as a
    // method-level guard on that one controller method below.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => [
        {
          limit: config.get('LOGIN_RATE_LIMIT_MAX', { infer: true }),
          ttl:
            config.get('LOGIN_RATE_LIMIT_WINDOW_SECONDS', {
              infer: true,
            }) * 1000,
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // AC34/AC35: the only place that wires a concrete EmailService — a
    // future real provider adapter (spec 006) only changes this line.
    { provide: EmailService, useClass: ConsoleEmailAdapter },
  ],
})
export class AuthModule {}
