import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithUser } from '../../modules/auth/guards/access-token.guard';
import { JsonLoggerService } from './json-logger.service';

/**
 * Spec 006 AC34: exactly one structured log line per HTTP request in
 * apps/api, containing ONLY `method`, `path`, `status`, `duration`, and
 * `userId` (present only when `AccessTokenGuard` populated `req.user`) —
 * never the request body, auth headers/cookies, or any other request/
 * response data.
 *
 * `path` is `req.path` (the route path, e.g. `/auth/login`) rather than
 * `req.originalUrl`, which would additionally include the query string.
 * This is a deliberately conservative default — no endpoint in this app
 * currently accepts a sensitive value as a query parameter, but choosing
 * `path` means a future one never leaks through this log line by
 * accident.
 *
 * Implemented as middleware, not an interceptor: an interceptor's
 * `tap`/`catchError` operators run before Nest's exception filters get a
 * chance to set the final HTTP status code on a thrown error, so
 * `response.statusCode` would not yet reflect e.g. the 409 `
 * PrismaExceptionFilter` maps a Prisma error to. Listening for the
 * response's own `finish` event guarantees the status code logged is
 * final regardless of whether the request succeeded, was rejected by a
 * guard, or hit an exception filter.
 *
 * Must run after `RequestIdMiddleware` (see `AppModule.configure()`) so
 * the `finish` listener registered here — even though it fires later,
 * once the response has actually been sent — still executes inside that
 * request's `AsyncLocalStorage` scope (Node propagates an active
 * `AsyncLocalStorage` store through `EventEmitter` listeners registered
 * from within a `.run()` callback), so `JsonLoggerService` still attaches
 * the correct `requestId`.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: JsonLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const userId = (req as Partial<RequestWithUser>).user?.sub;

      this.logger.logHttpRequest({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Math.round(durationMs),
        ...(userId ? { userId } : {}),
      });
    });

    next();
  }
}
