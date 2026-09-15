/**
 * Name of the HttpOnly refresh-token cookie set by `apps/api` on
 * `/auth/login` and `/auth/refresh`, and cleared on `/auth/logout`.
 * Shared so `apps/api` (sets/clears it) and `apps/web` (presence-checks it
 * in `middleware.ts`, spec 002 AC39) never drift on the literal name.
 */
export const AUTH_REFRESH_COOKIE_NAME = "cf_refresh_token";
