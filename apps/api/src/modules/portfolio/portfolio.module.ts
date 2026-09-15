import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleFactory } from '../../config/jwt.config';
import type { EnvConfig } from '../../config/env.schema';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

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
  providers: [PortfolioService],
})
export class PortfolioModule {}
