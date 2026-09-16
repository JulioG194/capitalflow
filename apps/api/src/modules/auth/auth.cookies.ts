import type { CookieOptions, Request } from 'express';
import { AUTH_REFRESH_COOKIE_NAME } from '@capitalflow/shared-types';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';

/**
 * Fixed literal value for the session-hint cookie (see
 * `AUTH_SESSION_HINT_COOKIE_NAME` in `@capitalflow/shared-types`). It is
 * intentionally not derived from any token/user data — its only job is to
 * be present or absent, never to carry information that could be replayed
 * or used to forge a session.
 */
export const SESSION_HINT_COOKIE_VALUE = '1';

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
 * Resolves the `SameSite` attribute shared by every auth cookie this module
 * sets/clears (spec 006 AC9).
 *
 * `apps/web` (Vercel) and `apps/api` (Render) are deployed to entirely
 * different registrable domains/sites in production — NOT same-site
 * subdomains as an earlier draft of this comment assumed — so a `Lax` (or
 * `Strict`) cookie would never be attached to `apps/web`'s cross-site
 * `fetch(..., { credentials: "include" })` calls at all. Cross-site
 * credentialed cookies require `SameSite=None`, which in turn requires
 * `Secure` (browsers reject `SameSite=None` without `Secure`).
 *
 * In development/test, `apps/web` and `apps/api` run on plain HTTP
 * (`localhost:3000` / `localhost:3001`), where `Secure` cookies are
 * silently dropped by the browser entirely — so dev/test uses `Lax` over
 * plain HTTP instead, which is still sent on `apps/web`'s same-site (both
 * `localhost`) cross-origin fetches.
 */
function resolveSameSite(
  config: ConfigService<EnvConfig, true>,
): 'none' | 'lax' {
  return config.get('NODE_ENV', { infer: true }) === 'production'
    ? 'none'
    : 'lax';
}

/**
 * Cookie attributes shared by every `res.cookie(...)` / `res.clearCookie(...)`
 * call that sets/clears the refresh-token cookie (spec 002 AC6, AC33; spec
 * 006 AC9). `Secure` is only enabled in production because local HTTP dev
 * servers can't set a `Secure` cookie at all (the browser silently drops
 * it), and `Secure` is mandatory whenever `SameSite=None` is used.
 */
export function buildRefreshCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  const refreshTtlDays = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: resolveSameSite(config),
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

/** Attributes used to clear the refresh cookie — must match `Path` used to set it. */
export function buildClearRefreshCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: resolveSameSite(config),
    path: REFRESH_COOKIE_PATH,
  };
}

/**
 * Cookie attributes for the "session hint" cookie (see
 * `AUTH_SESSION_HINT_COOKIE_NAME` in `@capitalflow/shared-types`). This is
 * a deliberate second, non-sensitive cookie — NOT a relaxation of the real
 * refresh cookie's `Path=/auth` scope.
 *
 * Why it exists: `apps/web`'s `middleware.ts` (AC39) needs to decide,
 * server-side, whether to redirect an unauthenticated `/app/*` request to
 * `/login`. The real refresh cookie is intentionally scoped to `Path=/auth`
 * (see the note above `REFRESH_COOKIE_PATH`), so per RFC 6265 path-matching
 * the browser never sends it on a `/app/*` request — middleware can't see
 * it there even immediately after a successful login. This hint cookie is
 * `path: '/'` so it *is* visible to middleware on every route, while the
 * real refresh token keeps its tight scope.
 *
 * Why it's safe: the value is the fixed literal `SESSION_HINT_COOKIE_VALUE`
 * ("1"), never a token, user id, or anything derived from one. Possessing
 * or forging this cookie's value grants no access by itself — it cannot be
 * exchanged for an access token, presented to any protected endpoint, or
 * used in place of the real refresh token. At worst, a forged hint cookie
 * causes middleware to let a request through to an `/app/*` page, which
 * then still fails to load any real data because the actual API calls
 * require a valid access token/refresh cookie that this cookie cannot
 * provide. It is `httpOnly: true` because there is no legitimate reason
 * for client-side JS to ever read it — keeping it HttpOnly avoids the
 * temptation to build client logic that depends on it instead of the
 * real in-memory access-token state (AC41).
 *
 * It must always be set/cleared in lockstep with the real refresh cookie
 * (same call sites, same `maxAge`) so the two never drift out of sync.
 *
 * `SameSite`/`Secure` follow the exact same production-vs-dev split as the
 * refresh cookie (spec 006 AC9, `resolveSameSite` above) — only `Path`
 * differs (`/` here, by design, vs `/auth` for the refresh cookie).
 */
export function buildSessionHintCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  const refreshTtlDays = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: resolveSameSite(config),
    path: '/',
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

/** Attributes used to clear the session-hint cookie — must match `Path` used to set it. */
export function buildClearSessionHintCookieOptions(
  config: ConfigService<EnvConfig, true>,
): CookieOptions {
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: resolveSameSite(config),
    path: '/',
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
