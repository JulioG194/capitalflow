import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
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
  ],
})
export class AuthModule {}
