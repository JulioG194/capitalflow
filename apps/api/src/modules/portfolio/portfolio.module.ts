import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
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
    // Spec 005 AC14/AC15: rate limit scoped to this module (distinct
    // config from AuthModule's IP-keyed login throttle) so
    // `InvestThrottlerGuard` resolves INVEST_RATE_LIMIT_MAX/WINDOW_SECONDS
    // from its own local import chain rather than AuthModule's.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => [
        {
          limit: config.get('INVEST_RATE_LIMIT_MAX', { infer: true }),
          ttl:
            config.get('INVEST_RATE_LIMIT_WINDOW_SECONDS', {
              infer: true,
            }) * 1000,
        },
      ],
    }),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, InvestThrottlerGuard],
})
export class PortfolioModule {}
