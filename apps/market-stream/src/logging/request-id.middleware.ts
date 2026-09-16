import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from './request-context';

/**
 * Spec 006 AC33/design decision 4: generates a per-HTTP-request id
 * (`crypto.randomUUID()` — no new dependency) and runs the rest of the
 * request pipeline inside `requestContextStorage.run(...)`, so
 * `JsonLoggerService` can read it back via `AsyncLocalStorage` for the
 * lifetime of this HTTP request. Applied only to this app's plain HTTP
 * routes (`/`, `/health`) — Socket.io connections are a separate transport
 * and are out of scope for AC33's "request-scoped" requestId.
 *
 * Duplicated from `apps/api`'s copy (human-approved design decision 1).
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    requestContextStorage.run({ requestId }, () => next());
  }
}
