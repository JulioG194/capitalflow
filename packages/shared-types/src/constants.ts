/**
 * Name of the HttpOnly refresh-token cookie set by `apps/api` on
 * `/auth/login` and `/auth/refresh`, and cleared on `/auth/logout`.
 * Shared so `apps/api` (sets/clears it) and `apps/web` (presence-checks it
 * in `middleware.ts`, spec 002 AC39) never drift on the literal name.
 *
 * NOTE: this cookie is scoped to `Path=/auth` (see
 * `apps/api/src/modules/auth/auth.cookies.ts`), so the browser never sends
 * it on `/app/*` requests. `apps/web`'s `middleware.ts` must NOT check for
 * this cookie's presence to gate `/app/*` routes — use
 * `AUTH_SESSION_HINT_COOKIE_NAME` below instead.
 */
export const AUTH_REFRESH_COOKIE_NAME = "cf_refresh_token";

/**
 * Name of a non-sensitive, `Path=/` "session hint" cookie set/cleared by
 * `apps/api` in lockstep with the real refresh-token cookie above (same
 * login/refresh/logout/failure call sites, same 7-day lifetime). Its value
 * is a fixed literal and carries no user identity or token material — it
 * exists solely so that `apps/web`'s `middleware.ts` (spec 002 AC39) has a
 * cookie it can actually see on `/app/*` requests to decide whether to
 * redirect to `/login`, since the real refresh cookie's `Path=/auth` scope
 * means the browser never transmits it there. Presence of this cookie is
 * only ever used as a redirect hint, never to authorize a request or
 * substitute for the real refresh/access tokens.
 */
export const AUTH_SESSION_HINT_COOKIE_NAME = "cf_has_session";
