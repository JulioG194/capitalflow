import { Injectable, type LoggerService, type LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

/** This service's name in the `service` field of every JSON log line. */
const SERVICE_NAME = 'api';

/**
 * Spec 006 AC34: the exact — and only — request-specific fields allowed
 * on the per-HTTP-request summary line. `userId` is omitted (not `null`/
 * `undefined`) when the request was never authenticated.
 */
export interface HttpRequestLogFields {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: string;
}

interface ParsedLogArgs {
  context?: string;
  stack?: string;
  extraMessages: unknown[];
}

/**
 * Hand-rolled structured JSON logger (spec 006 AC33) implementing Nest's
 * own `LoggerService` interface directly — no `pino`/`winston`/
 * `nestjs-pino` dependency (human-approved design decision 2). Wired via
 * `app.useLogger(...)` in `main.ts`, so every existing `Logger.log/warn/
 * error/debug` call site already in the codebase (the JWT boot-fingerprint
 * log, the `[password-reset]` line, `PrismaExceptionFilter`,
 * `HealthService`, ...) is converted to structured JSON retroactively,
 * with no change to any of those call sites (design decision 3).
 *
 * Every line has `timestamp` (ISO-8601), `level`, `service`, and `msg`.
 * `requestId` is added only when `getRequestId()` returns a value (i.e.
 * only inside `RequestIdMiddleware`'s `AsyncLocalStorage` scope) — the key
 * is entirely absent otherwise, never present with an empty/undefined
 * value (spec 006 AC33/AC34 edge case: boot-time logs).
 *
 * `context` — Nest's own second/last argument convention for
 * `Logger.log/warn/debug/verbose/error` (see `@nestjs/common`'s
 * `Logger`/`ConsoleLogger`: a `Logger` instance bound to a class name via
 * `new Logger(SomeClass.name)` always appends that name as the final
 * argument passed through to whatever logger is registered via
 * `app.useLogger(...)`) — is surfaced as its own top-level `context` field,
 * kept separate from `msg` so `msg` stays exactly what the call site
 * passed as its message.
 */
@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  /**
   * AC34: exactly one structured line per HTTP request, carrying ONLY
   * `method`, `path`, `status`, `duration`, and `userId` (when
   * authenticated) as request-specific data on top of the standard
   * envelope fields every log line gets (AC33) — no body, no headers, no
   * other request/response data. The only caller is
   * `RequestLoggingMiddleware`, which is solely responsible for selecting
   * exactly those fields.
   */
  logHttpRequest(fields: HttpRequestLogFields): void {
    const line: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: 'log' satisfies LogLevel,
      service: SERVICE_NAME,
      msg: 'HTTP request',
      ...fields,
    };
    this.attachRequestId(line);
    this.emit(line, 'log');
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const { context, stack, extraMessages } = this.parseOptionalParams(
      level,
      optionalParams,
    );

    const line: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      msg: [
        this.stringify(message),
        ...extraMessages.map((m) => this.stringify(m)),
      ]
        .filter((part) => part.length > 0)
        .join(' '),
    };

    this.attachRequestId(line);
    if (context) {
      line.context = context;
    }
    if (stack) {
      line.stack = stack;
    }

    this.emit(line, level);
  }

  private attachRequestId(line: Record<string, unknown>): void {
    const requestId = getRequestId();
    if (requestId) {
      line.requestId = requestId;
    }
  }

  /**
   * Mirrors the shape Nest's own bound `Logger` instances produce (see
   * `Logger.prototype.log`/`.error` in `@nestjs/common`):
   * - `log`/`warn`/`debug`/`verbose`: `(message, ...rest, context?)` — the
   *   last argument is `context` if it's a string.
   * - `error`: a `Logger` bound to a class always concatenates
   *   `(stack | undefined, context)` onto whatever the call site passed,
   *   so the last two slots are `[stack, context]` once a context is
   *   bound. An un-bound, static `Logger.error(...)` call has no such
   *   guarantee; a single trailing string with no newline is treated as
   *   `context` rather than `stack` (a real stack trace is always
   *   multi-line).
   */
  private parseOptionalParams(level: LogLevel, args: unknown[]): ParsedLogArgs {
    if (level !== 'error') {
      if (args.length === 0) {
        return { extraMessages: [] };
      }
      const last = args[args.length - 1];
      if (typeof last === 'string') {
        return { context: last, extraMessages: args.slice(0, -1) };
      }
      return { extraMessages: args };
    }

    if (args.length === 0) {
      return { extraMessages: [] };
    }
    if (args.length === 1) {
      const only = args[0];
      if (typeof only === 'string' && !only.includes('\n')) {
        return { context: only, extraMessages: [] };
      }
      return {
        stack: typeof only === 'string' ? only : undefined,
        extraMessages: typeof only === 'string' ? [] : [only],
      };
    }

    const last = args[args.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const rest = context !== undefined ? args.slice(0, -1) : args;

    const maybeStack = rest[rest.length - 1];
    const stack = typeof maybeStack === 'string' ? maybeStack : undefined;
    const extraMessages = stack !== undefined ? rest.slice(0, -1) : rest;

    return { context, stack, extraMessages };
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.message;
    }
    if (value === undefined) {
      return '';
    }
    try {
      return JSON.stringify(value);
    } catch {
      // JSON.stringify only throws for BigInt or circular structures.
      // `Object.prototype.toString.call` never depends on `value`'s own
      // (possibly absent/overridden) `toString`, unlike a bare
      // `String(value)` — which is exactly what
      // `@typescript-eslint/no-base-to-string` guards against for an
      // `unknown`-typed value.
      return Object.prototype.toString.call(value);
    }
  }

  private emit(line: Record<string, unknown>, level: LogLevel): void {
    const json = JSON.stringify(line);
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(`${json}\n`);
    } else {
      process.stdout.write(`${json}\n`);
    }
  }
}
