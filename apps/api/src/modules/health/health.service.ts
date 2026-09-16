import { Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@capitalflow/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Spec 006 AC25: `GET /health` on apps/api. Pings Postgres via the existing
 * `PrismaService` on every call (a lightweight `SELECT 1`, not a pooled
 * health-check cache) — this is a low-traffic endpoint (Render's own health
 * check plus the repo's keep-alive workflow, both on a multi-minute cadence),
 * so a fresh check per request is cheap and never stale.
 *
 * Errors from `$queryRaw` are swallowed here and turned into `db: "error"` —
 * never rethrown — so a DB outage reports `degraded` instead of leaking a
 * raw Prisma error to the caller (CLAUDE.md: never leak Prisma errors).
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const db = await this.pingDatabase();
    const version = process.env.RENDER_GIT_COMMIT;

    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      service: 'api',
      ...(version ? { version } : {}),
      db,
    };
  }

  private async pingDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return 'error';
    }
  }
}
