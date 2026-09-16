import { Global, Module } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';
import { RequestIdMiddleware } from './request-id.middleware';

/**
 * Spec 006 AC33. `@Global()` so:
 * - `main.ts` can retrieve `JsonLoggerService` via `app.get(...)` right
 *   after `NestFactory.create(...)` for `app.useLogger(...)`.
 * - `AppModule.configure()` can apply `RequestIdMiddleware` without every
 *   other module needing to import this one explicitly.
 */
@Global()
@Module({
  providers: [JsonLoggerService, RequestIdMiddleware],
  exports: [JsonLoggerService, RequestIdMiddleware],
})
export class LoggingModule {}
