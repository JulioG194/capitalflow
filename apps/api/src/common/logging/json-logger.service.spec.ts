import { JsonLoggerService } from './json-logger.service';
import { requestContextStorage } from './request-context';

function parseJsonLine(line: string): unknown {
  return JSON.parse(line) as unknown;
}

function captureStdout(): { lines: () => unknown[] } {
  const writes: string[] = [];
  jest
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    });
  return { lines: () => writes.map(parseJsonLine) };
}

function captureStderr(): { lines: () => unknown[] } {
  const writes: string[] = [];
  jest
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    });
  return { lines: () => writes.map(parseJsonLine) };
}

describe('JsonLoggerService', () => {
  let logger: JsonLoggerService;

  beforeEach(() => {
    logger = new JsonLoggerService();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('AC33: emits valid JSON with timestamp, level, service, msg on stdout for .log()', () => {
    const stdout = captureStdout();

    logger.log('hello world');

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect(line).toMatchObject({
      level: 'log',
      service: 'api',
      msg: 'hello world',
    });
    expect(typeof line.timestamp).toBe('string');
    expect(() =>
      new Date(line.timestamp as string).toISOString(),
    ).not.toThrow();
  });

  it('AC33: omits the requestId key entirely outside an AsyncLocalStorage scope', () => {
    const stdout = captureStdout();

    logger.log('boot message');

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect('requestId' in line).toBe(false);
  });

  it('AC33: includes requestId when called inside an active request scope', () => {
    const stdout = captureStdout();

    requestContextStorage.run({ requestId: 'req-42' }, () => {
      logger.log('inside a request');
    });

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect(line.requestId).toBe('req-42');
  });

  it('captures a bound-instance-style context as its own `context` field for .log()', () => {
    const stdout = captureStdout();

    // Mirrors what `Logger.prototype.log` does when a `Logger` is bound to
    // a class name: it appends the class name as the last argument.
    logger.log('JWT public key fingerprint: abc123', 'Bootstrap');

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect(line.msg).toBe('JWT public key fingerprint: abc123');
    expect(line.context).toBe('Bootstrap');
  });

  it('routes .error() lines to stderr, not stdout', () => {
    const stdout = captureStdout();
    const stderr = captureStderr();

    logger.error('boom');

    expect(stdout.lines()).toHaveLength(0);
    expect(stderr.lines()).toHaveLength(1);
  });

  it('parses a bound-instance-style .error() call as (message, stack|undefined, context)', () => {
    const stderr = captureStderr();

    // Mirrors PrismaExceptionFilter's `this.logger.error(message, stack)`
    // with a context bound at construction (`new Logger(ClassName.name)`),
    // which `Logger.prototype.error` turns into
    // `(message, stack, 'PrismaExceptionFilter')`.
    logger.error(
      'Prisma error',
      'Error: boom\n  at foo.ts:1:1',
      'PrismaExceptionFilter',
    );

    const [line] = stderr.lines() as Array<Record<string, unknown>>;
    expect(line.msg).toBe('Prisma error');
    expect(line.stack).toBe('Error: boom\n  at foo.ts:1:1');
    expect(line.context).toBe('PrismaExceptionFilter');
  });

  it('parses a bound-instance-style .error() call with no stack as (message, undefined, context)', () => {
    const stderr = captureStderr();

    // Mirrors HealthService's `this.logger.error('Database health check failed: ...')`
    // with a bound context, which `Logger.prototype.error` turns into
    // `(message, undefined, 'HealthService')`.
    logger.error(
      'Database health check failed: connection refused',
      undefined,
      'HealthService',
    );

    const [line] = stderr.lines() as Array<Record<string, unknown>>;
    expect(line.msg).toBe('Database health check failed: connection refused');
    expect(line.context).toBe('HealthService');
    expect('stack' in line).toBe(false);
  });

  describe('logHttpRequest (AC34)', () => {
    it('emits exactly method, path, status, duration as request-specific fields when unauthenticated', () => {
      const stdout = captureStdout();

      logger.logHttpRequest({
        method: 'GET',
        path: '/health',
        status: 200,
        duration: 12,
      });

      const [line] = stdout.lines() as Array<Record<string, unknown>>;
      expect(line.method).toBe('GET');
      expect(line.path).toBe('/health');
      expect(line.status).toBe(200);
      expect(line.duration).toBe(12);
      expect('userId' in line).toBe(false);
    });

    it('includes userId only when provided (authenticated request)', () => {
      const stdout = captureStdout();

      logger.logHttpRequest({
        method: 'POST',
        path: '/portfolio/invest',
        status: 201,
        duration: 34,
        userId: 'user-1',
      });

      const [line] = stdout.lines() as Array<Record<string, unknown>>;
      expect(line.userId).toBe('user-1');
    });

    it('still carries the AC33 envelope (timestamp/level/service/msg) alongside the AC34 fields', () => {
      const stdout = captureStdout();

      logger.logHttpRequest({
        method: 'GET',
        path: '/health',
        status: 200,
        duration: 1,
      });

      const [line] = stdout.lines() as Array<Record<string, unknown>>;
      expect(line).toMatchObject({ level: 'log', service: 'api' });
      expect(typeof line.timestamp).toBe('string');
      expect(typeof line.msg).toBe('string');
    });

    it('includes requestId when inside a request scope', () => {
      const stdout = captureStdout();

      requestContextStorage.run({ requestId: 'req-99' }, () => {
        logger.logHttpRequest({
          method: 'GET',
          path: '/health',
          status: 200,
          duration: 1,
        });
      });

      const [line] = stdout.lines() as Array<Record<string, unknown>>;
      expect(line.requestId).toBe('req-99');
    });
  });
});
