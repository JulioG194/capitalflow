import { Global, Module } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestLoggingMiddleware } from './request-logging.middleware';

/**
 * Spec 006 AC33/AC34. `@Global()` so:
 * - `main.ts` can retrieve `JsonLoggerService` via `app.get(...)` right
 *   after `NestFactory.create(...)` for `app.useLogger(...)`.
 * - `AppModule.configure()` can apply `RequestIdMiddleware` and
 *   `RequestLoggingMiddleware` without every feature module needing to
 *   import this one explicitly.
 */
@Global()
@Module({
  providers: [JsonLoggerService, RequestIdMiddleware, RequestLoggingMiddleware],
  exports: [JsonLoggerService, RequestIdMiddleware, RequestLoggingMiddleware],
})
export class LoggingModule {}
