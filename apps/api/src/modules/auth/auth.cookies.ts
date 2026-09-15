import type { CookieOptions, Request } from 'express';
import { AUTH_REFRESH_COOKIE_NAME } from '@capitalflow/shared-types';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';

/**
 * Cookie `Path` scope for the refresh-token cookie.
 *
 * Spec 002 AC6/AC33 originally specified `/auth/refresh`, but that literal
 * scope makes `POST /auth/logout` (AC18) unimplementable: browsers only
 * attach a cookie to requests whose path matches (or is nested under) the
 * cookie's `Path`, so a cookie scoped to `/auth/refresh` would never be
 * sent on a `/auth/logout` request — logout could never read/revoke the
 * presented token, only blindly clear a cookie it never saw. Scoping to
 * `/auth` instead keeps the actual security intent named in AC33 (the
 * refresh cookie is never transmitted to unrelated, non-auth routes like a
 * future `/portfolios/*`) while remaining present on `/auth/refresh`,
 * `/auth/logout`, and `/auth/login`. AC6/AC33 text has been corrected to
 * say `/auth` in the same commit as this code (see specs/002-auth-users.md).
 */
export const REFRESH_COOKIE_PATH = '/auth';

/**
 * Cookie attributes shared by every `res.cookie(...)` / `res.clearCookie(...)`
 * call that sets/clears the refresh-token cookie (spec 002 AC6, AC33).
 * `Secure` is only enabled in production because local HTTP dev servers
 * can't set a `Secure` cookie at all (the browser silently drops it).
 * `SameSite=Lax` is used rather than `Strict`: `apps/web` and `apps/api`
 * are different origins (different ports in dev, likely subdomains in
 * prod) but the same registrable *site*, and `Lax` cookies are still sent
 * on same-site cross-origin `fetch(..., { credentials: "include" })`
 * calls — which is exactly how `apps/web`'s `authFetch` talks to this API.
 */
export function buildRefreshCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  const refreshTtlDays = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });

  return {
    httpOnly: true,
    secure: config.get('NODE_ENV', { infer: true }) === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

/** Attributes used to clear the refresh cookie — must match `Path` used to set it. */
export function buildClearRefreshCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get('NODE_ENV', { infer: true }) === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

/**
 * Type-safe read of the refresh-token cookie off an Express request.
 * `cookie-parser`'s own type augmentation declares `Request.cookies` as
 * `any`; this narrows it back to `string | undefined` at the boundary so
 * that `any` never leaks into our own code (CLAUDE.md: no `any`).
 */
export function readRefreshCookie(req: Request): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value = (cookies as Record<string, unknown>)[AUTH_REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}
