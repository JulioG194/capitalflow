/**
 * Typed error thrown by `auth-client.ts` for any non-2xx `/auth/*` response.
 * Carries the server's status/message/code so callers (forms) can decide how
 * much of it to surface — e.g. `LoginForm` deliberately ignores `.message`
 * on a 401 and shows its own fixed generic copy (spec 002 AC38).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    // Populated from a 429 response's `Retry-After` header (spec 005 AC30) so
    // a caller can surface a wait time without re-reading response headers
    // itself — optional and defaulted so every existing 3-arg call site
    // (auth flows) keeps compiling unchanged.
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
