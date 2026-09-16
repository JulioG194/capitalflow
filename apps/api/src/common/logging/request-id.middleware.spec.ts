import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { getRequestId } from './request-context';

describe('RequestIdMiddleware', () => {
  it('AC33: generates a requestId and runs downstream code inside its AsyncLocalStorage scope', () => {
    const middleware = new RequestIdMiddleware();
    let observedId: string | undefined;
    const next: NextFunction = () => {
      observedId = getRequestId();
    };

    middleware.use({} as Request, {} as Response, next);

    expect(observedId).toBeDefined();
    expect(observedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates a distinct id on every call', () => {
    const middleware = new RequestIdMiddleware();
    const ids: (string | undefined)[] = [];

    middleware.use({} as Request, {} as Response, () =>
      ids.push(getRequestId()),
    );
    middleware.use({} as Request, {} as Response, () =>
      ids.push(getRequestId()),
    );

    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBeDefined();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('the requestId is not observable once .use() has returned (outside the request)', () => {
    const middleware = new RequestIdMiddleware();

    middleware.use({} as Request, {} as Response, () => {});

    expect(getRequestId()).toBeUndefined();
  });
});
