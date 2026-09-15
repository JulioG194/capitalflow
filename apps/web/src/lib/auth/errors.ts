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
  ) {
    super(message);
    this.name = "ApiError";
  }
}
