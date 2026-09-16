import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { MarketIoAdapter } from './market-io.adapter';
import { AppConfigService } from '../config/app-config.service';

/**
 * Verifies `MarketIoAdapter#createIOServer` reads live config off the
 * already-bootstrapped Nest app (not `process.env`) and forwards a CORS
 * option to the base `IoAdapter#createIOServer` that enforces the shared
 * allowlist (spec 006 AC10). Spins up neither a real HTTP server nor a
 * real Socket.io connection — `super.createIOServer` is stubbed so this
 * only asserts what options our override computes and passes through.
 */
describe('MarketIoAdapter (spec 006 AC10)', () => {
  function fakeAppContext(env: {
    WEB_APP_ORIGIN: string;
    WEB_PREVIEW_ORIGIN_REGEX?: string;
  }): INestApplicationContext {
    const configService = {
      get: jest.fn((key: string) => env[key as keyof typeof env]),
    } as unknown as AppConfigService;

    return {
      get: jest.fn((token: unknown) => {
        if (token === AppConfigService) return configService;
        throw new Error(`Unexpected token requested: ${String(token)}`);
      }),
    } as unknown as INestApplicationContext;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds cors options from AppConfigService and forwards them to the base adapter', () => {
    const superCreateIOServer = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue('fake-server');

    const appContext = fakeAppContext({
      WEB_APP_ORIGIN: 'https://capitalflow.vercel.app',
    });
    const adapter = new MarketIoAdapter(appContext);

    const result = adapter.createIOServer(3002, { namespace: '/market' });

    expect(result).toBe('fake-server');
    expect(superCreateIOServer).toHaveBeenCalledTimes(1);
    const [port, options] = superCreateIOServer.mock.calls[0] as [
      number,
      { namespace?: string; cors?: { origin: unknown; credentials?: boolean } },
    ];
    expect(port).toBe(3002);
    expect(options.namespace).toBe('/market');
    expect(options.cors?.credentials).toBe(true);
  });

  it('overrides any cors option already present on the passed-in options', () => {
    const superCreateIOServer = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue('fake-server');

    const appContext = fakeAppContext({
      WEB_APP_ORIGIN: 'https://capitalflow.vercel.app',
    });
    const adapter = new MarketIoAdapter(appContext);

    adapter.createIOServer(3002, {
      // Simulates the now-vestigial `@WebSocketGateway({ cors: { origin: true } })`
      // value still flowing through `options` — our adapter must win.
      cors: { origin: true, credentials: true },
    });

    const [, options] = superCreateIOServer.mock.calls[0] as [
      number,
      { cors?: { origin: unknown } },
    ];
    expect(options.cors?.origin).not.toBe(true);
    expect(typeof options.cors?.origin).toBe('function');
  });

  it('rejects an origin outside the allowlist via the forwarded cors.origin callback', () => {
    const superCreateIOServer = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue('fake-server');

    const appContext = fakeAppContext({
      WEB_APP_ORIGIN: 'https://capitalflow.vercel.app',
    });
    const adapter = new MarketIoAdapter(appContext);
    adapter.createIOServer(3002);

    const [, options] = superCreateIOServer.mock.calls[0] as [
      number,
      {
        cors?: {
          origin: (
            origin: string | undefined,
            cb: (err: Error | null, allow?: boolean) => void,
          ) => void;
        };
      },
    ];
    const callback = jest.fn();

    options.cors?.origin('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [err] = callback.mock.calls[0] as [Error | null];
    expect(err).toBeInstanceOf(Error);
  });
});
