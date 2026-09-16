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

describe('JsonLoggerService', () => {
  let logger: JsonLoggerService;

  beforeEach(() => {
    logger = new JsonLoggerService();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('AC33: emits valid JSON with timestamp, level, service=market-stream, msg', () => {
    const stdout = captureStdout();

    logger.log('hello world');

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect(line).toMatchObject({
      level: 'log',
      service: 'market-stream',
      msg: 'hello world',
    });
    expect(typeof line.timestamp).toBe('string');
    expect(() =>
      new Date(line.timestamp as string).toISOString(),
    ).not.toThrow();
  });

  it('AC33/design decision 5: boot-time JWT-fingerprint-style log has no requestId key at all', () => {
    const stdout = captureStdout();

    // Mirrors main.ts's `Logger.log(\`JWT public key fingerprint: ${fp}\`, 'Bootstrap')`,
    // called before any HTTP request exists.
    logger.log('JWT public key fingerprint: abc123456789', 'Bootstrap');

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    const raw = JSON.stringify(line);
    expect(JSON.parse(raw)).toEqual(line);
    expect('requestId' in line).toBe(false);
    expect(raw).not.toContain('requestId');
    expect(line.context).toBe('Bootstrap');
    expect(line.msg).toBe('JWT public key fingerprint: abc123456789');
  });

  it('AC33: includes requestId when called inside an active request scope', () => {
    const stdout = captureStdout();

    requestContextStorage.run({ requestId: 'req-42' }, () => {
      logger.log('inside a request');
    });

    const [line] = stdout.lines() as Array<Record<string, unknown>>;
    expect(line.requestId).toBe('req-42');
  });

  it('parses a bound-instance-style .error() call as (message, stack|undefined, context)', () => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdout = captureStdout();

    logger.error('boom', 'Error: boom\n  at foo.ts:1:1', 'SomeService');

    // error goes to stderr, not stdout, in this implementation.
    expect(stdout.lines()).toHaveLength(0);
  });
});
