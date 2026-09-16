import { buildMarketCorsOptions } from './market-cors';

/**
 * `buildMarketCorsOptions` wraps `isOriginAllowed` (already exhaustively
 * unit-tested in `@capitalflow/shared-types`) in the `(origin, callback)`
 * shape Socket.io/`cors` expect. These tests only verify that wiring —
 * the callback is invoked with the right arguments for allow/reject — not
 * every allowlist branch again.
 */
describe('buildMarketCorsOptions (spec 006 AC10)', () => {
  const webAppOrigin = 'https://capitalflow.vercel.app';

  it('allows a matching origin by calling back with (null, true)', () => {
    const cors = buildMarketCorsOptions({ webAppOrigin });
    const origin = cors.origin;
    const callback = jest.fn();

    origin(webAppOrigin, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows requests with no Origin header', () => {
    const cors = buildMarketCorsOptions({ webAppOrigin });
    const origin = cors.origin;
    const callback = jest.fn();

    origin(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects a disallowed origin by calling back with an Error', () => {
    const cors = buildMarketCorsOptions({ webAppOrigin });
    const origin = cors.origin;
    const callback = jest.fn();

    origin('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [err, allow] = callback.mock.calls[0] as [Error | null, unknown];
    expect(err).toBeInstanceOf(Error);
    expect(allow).toBeUndefined();
  });

  it('allows a preview origin only when webPreviewOriginRegex is configured', () => {
    const webPreviewOriginRegex =
      '^https://capitalflow-[a-z0-9-]+\\.vercel\\.app$';
    const cors = buildMarketCorsOptions({
      webAppOrigin,
      webPreviewOriginRegex,
    });
    const origin = cors.origin;
    const callback = jest.fn();

    origin('https://capitalflow-pr-7.vercel.app', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('always sets credentials: true', () => {
    const cors = buildMarketCorsOptions({ webAppOrigin });
    expect(cors.credentials).toBe(true);
  });
});
