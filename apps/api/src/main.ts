import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import type { EnvConfig } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvConfig, true>);

  // Credentialed cross-origin requests (the refresh cookie, sent via
  // `fetch(..., { credentials: "include" })` from apps/web) require an
  // explicit origin — `credentials: true` is incompatible with the
  // wildcard `*` origin CORS otherwise defaults to.
  //
  // `exposedHeaders` is required because a browser hides all
  // non-"simple" response headers from cross-origin `fetch()` callers by
  // default — without this, `Retry-After` on a 429 (spec 002's login
  // throttle and spec 005 AC30's invest throttle) is set by the server
  // but invisible to apps/web's `response.headers.get("Retry-After")`.
  app.enableCors({
    origin: configService.get('WEB_APP_ORIGIN', { infer: true }),
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
