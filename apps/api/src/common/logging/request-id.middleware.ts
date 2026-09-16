import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from './request-context';

/**
 * Spec 006 AC33/design decision 4: generates a per-request id
 * (`crypto.randomUUID()` — already available via Node, no new dependency)
 * and runs the rest of the request pipeline (every subsequent middleware,
 * guard, interceptor, controller, and exception filter) inside
 * `requestContextStorage.run(...)`, so `JsonLoggerService` can read it back
 * for the lifetime of this request via `AsyncLocalStorage` — never via a
 * method-signature parameter or a module-level mutable variable.
 *
 * Must be registered before `RequestLoggingMiddleware` (see
 * `AppModule.configure()`) so that middleware's own logging — and the
 * `res.on('finish', ...)` listener it registers — also runs inside this
 * scope.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    requestContextStorage.run({ requestId }, () => next());
  }
}
