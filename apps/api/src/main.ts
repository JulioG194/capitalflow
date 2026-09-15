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
  app.enableCors({
    origin: configService.get('WEB_APP_ORIGIN', { infer: true }),
    credentials: true,
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
