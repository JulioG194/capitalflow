import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { EnvConfig } from '../config/env.schema';

/**
 * Thin wrapper around the generated Prisma client. Prisma 7 requires a
 * driver adapter (no more implicit `DATABASE_URL` pickup), so the adapter
 * is constructed here from validated config rather than left to Prisma's
 * defaults.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService<EnvConfig, true>) {
    const adapter = new PrismaPg({
      connectionString: configService.get('DATABASE_URL', { infer: true }),
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
