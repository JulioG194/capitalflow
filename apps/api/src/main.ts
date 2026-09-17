import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { isOriginAllowed } from '@capitalflow/shared-types';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JsonLoggerService } from './common/logging/json-logger.service';
import type { EnvConfig } from './config/env.schema';

/**
 * Matches `@nestjs/common`'s internal (not publicly re-exported)
 * `CustomOrigin` type for `CorsOptions.origin` — declared locally rather
 * than importing an unexported type from the package's internals.
 */
type CorsOriginFn = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void;

async function bootstrap() {
  // Spec 006 AC33: `bufferLogs: true` holds every log emitted during
  // `NestFactory.create()` itself (Nest's own "Starting Nest
  // application...", module-initialization lines, etc.) in memory instead
  // of writing them with the default `ConsoleLogger` — `app.useLogger(...)`
  // below flushes that buffer through `JsonLoggerService` once it's
  // registered, so even those very first boot lines come out as
  // structured JSON rather than being lost or logged in the wrong format.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(JsonLoggerService));

  // Render (and any reverse proxy) terminates TLS and forwards the client
  // IP in X-Forwarded-For. Without this, ThrottlerGuard's default IP
  // tracker keys every login against the proxy hop and either rate-limits
  // the whole world as one client or never sees the real caller.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API is JSON-only; CSP is enforced on apps/web instead.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const configService = app.get(ConfigService<EnvConfig, true>);

  // Credentialed cross-origin requests require an explicit origin —
  // `credentials: true` is incompatible with the wildcard `*` origin CORS
  // otherwise defaults to. The origin callback defers to the shared
  // `isOriginAllowed` allowlist (spec 006 AC7) so apps/api and
  // apps/market-stream's Socket.io `IoAdapter` (AC10) apply the exact
  // same three rules instead of two hand-copies that could drift.
  //
  // Production note: browsers hit Vercel same-origin rewrites, so CORS is
  // mostly for direct tooling and any leftover absolute API_URL. Keep the
  // allowlist anyway.
  //
  // `exposedHeaders` is required because a browser hides all
  // non-"simple" response headers from cross-origin `fetch()` callers by
  // default — without this, `Retry-After` on a 429 (spec 002's login
  // throttle and spec 005 AC30's invest throttle) is set by the server
  // but invisible to apps/web's `response.headers.get("Retry-After")`.
  const corsOrigin: CorsOriginFn = (origin, callback) => {
    const allowed = isOriginAllowed(origin, {
      webAppOrigin: configService.get('WEB_APP_ORIGIN', { infer: true }),
      webPreviewOriginRegex: configService.get('WEB_PREVIEW_ORIGIN_REGEX', {
        infer: true,
      }),
    });
    if (allowed) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS: origin not allowed'));
  };

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(configService.get('PORT', { infer: true }));
}

void bootstrap();
