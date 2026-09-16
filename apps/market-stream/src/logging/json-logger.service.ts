import { Injectable, type LoggerService, type LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

/** This service's name in the `service` field of every JSON log line. */
const SERVICE_NAME = 'market-stream';

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
 * error/debug` call site already in this app (most notably the JWT
 * public-key-fingerprint boot log in `main.ts`) is converted to structured
 * JSON retroactively, with no change to that call site.
 *
 * This is a deliberate near-duplicate of `apps/api`'s
 * `JsonLoggerService` (human-approved design decision 1) — the only
 * differences are `SERVICE_NAME` and the absence of AC34's
 * `logHttpRequest` method, since the per-request summary line is scoped
 * to apps/api only.
 *
 * Every line has `timestamp` (ISO-8601), `level`, `service`, and `msg`.
 * `requestId` is added only when `getRequestId()` returns a value (i.e.
 * only inside `RequestIdMiddleware`'s `AsyncLocalStorage` scope) — the key
 * is entirely absent otherwise, never present with an empty/undefined
 * value. This matters most for this app's own boot-time JWT fingerprint
 * log, which runs before any HTTP request exists.
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

    const requestId = getRequestId();
    if (requestId) {
      line.requestId = requestId;
    }
    if (context) {
      line.context = context;
    }
    if (stack) {
      line.stack = stack;
    }

    this.emit(line, level);
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
