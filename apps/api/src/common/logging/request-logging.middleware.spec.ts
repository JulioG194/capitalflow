import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import type { JsonLoggerService } from './json-logger.service';

function makeResponse(statusCode: number): Response & EventEmitter {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { statusCode }) as Response & EventEmitter;
}

describe('RequestLoggingMiddleware', () => {
  let logHttpRequest: jest.Mock;
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
    logHttpRequest = jest.fn();
    middleware = new RequestLoggingMiddleware({
      logHttpRequest,
    } as unknown as JsonLoggerService);
  });

  it('AC34: logs method, path, status, duration once the response finishes, and no more', () => {
    const req = { method: 'GET', path: '/health' } as Request;
    const res = makeResponse(200);
    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(logHttpRequest).not.toHaveBeenCalled();

    res.emit('finish');

    expect(logHttpRequest).toHaveBeenCalledTimes(1);
    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(fields).sort()).toEqual(
      ['duration', 'method', 'path', 'status'].sort(),
    );
    expect(fields.method).toBe('GET');
    expect(fields.path).toBe('/health');
    expect(fields.status).toBe(200);
    expect(typeof fields.duration).toBe('number');
  });

  it('AC34: includes userId only when req.user was populated by AccessTokenGuard', () => {
    const req = {
      method: 'POST',
      path: '/portfolio/invest',
      user: { sub: 'user-1', email: 'a@b.com' },
    } as unknown as Request;
    const res = makeResponse(201);

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    expect(fields.userId).toBe('user-1');
    expect(Object.keys(fields).sort()).toEqual(
      ['duration', 'method', 'path', 'status', 'userId'].sort(),
    );
  });

  it('AC34: omits userId for an unauthenticated request', () => {
    const req = { method: 'GET', path: '/health' } as Request;
    const res = makeResponse(200);

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    expect('userId' in fields).toBe(false);
  });

  it('AC34: uses req.path (never req.originalUrl / the query string) as `path`', () => {
    const req = {
      method: 'GET',
      path: '/auth/reset-password',
      originalUrl: '/auth/reset-password?token=super-secret',
    } as unknown as Request;
    const res = makeResponse(200);

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    expect(fields.path).toBe('/auth/reset-password');
  });

  it('AC34: reflects the final status code, not any interim value res.statusCode had at request start', () => {
    const req = { method: 'POST', path: '/auth/register' } as Request;
    const res = makeResponse(200);

    middleware.use(req, res, jest.fn());
    // Simulate an exception filter changing the status after the handler ran.
    res.statusCode = 409;
    res.emit('finish');

    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    expect(fields.status).toBe(409);
  });

  it('never includes request body, headers, or any field beyond the AC34 allow-list', () => {
    const req = {
      method: 'POST',
      path: '/auth/login',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'refresh_token=abc',
      },
      body: { email: 'a@b.com', password: 'hunter2' },
      query: { foo: 'bar' },
    } as unknown as Request;
    const res = makeResponse(200);

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    const [fields] = logHttpRequest.mock.calls[0] as [Record<string, unknown>];
    const allowed = new Set(['method', 'path', 'status', 'duration', 'userId']);
    for (const key of Object.keys(fields)) {
      expect(allowed.has(key)).toBe(true);
    }
    expect(JSON.stringify(fields)).not.toMatch(
      /secret-token|hunter2|refresh_token/,
    );
  });
});
