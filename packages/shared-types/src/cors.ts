/**
 * Shared cross-origin allowlist rule (spec 006 AC7/AC10). Both apps/api's
 * `app.enableCors()` origin callback and apps/market-stream's Socket.io
 * `IoAdapter` (see `apps/market-stream/src/market/market-cors.ts`) call this
 * same pure function so the two services can never drift on what origins
 * are allowed to make credentialed requests.
 *
 * Rule, in order:
 * 1. No `Origin` header at all (curl, server-to-server calls, Render's own
 *    health check, the repo's keepalive GitHub Actions workflow) -> always
 *    allow. None of these send an `Origin` header, and none of them carry
 *    cookies that credentialed-CORS is meant to protect.
 * 2. Exact match on `http://localhost:3000` (local dev) -> allow.
 * 3. Exact match on the configured `webAppOrigin` (the deployed apps/web
 *    origin, e.g. the Vercel production URL) -> allow.
 * 4. `webPreviewOriginRegex` is set AND it matches -> allow.
 * 5. Otherwise -> reject.
 *
 * `webPreviewOriginRegex` is deliberately OPTIONAL with NO default value.
 * If it is absent/undefined, rule 4 never fires and NO preview origins are
 * allowed at all — this is a fail-closed design, not an oversight. A
 * previous draft proposed a permissive default; that was explicitly
 * rejected in favor of failing closed when the operator hasn't configured
 * a preview regex.
 */
export interface OriginAllowlistConfig {
  webAppOrigin: string;
  webPreviewOriginRegex?: string;
}

const LOCAL_DEV_ORIGIN = 'http://localhost:3000';

export function isOriginAllowed(
  origin: string | undefined,
  config: OriginAllowlistConfig,
): boolean {
  if (!origin) {
    return true;
  }
  if (origin === LOCAL_DEV_ORIGIN) {
    return true;
  }
  if (origin === config.webAppOrigin) {
    return true;
  }
  if (config.webPreviewOriginRegex) {
    const pattern = new RegExp(config.webPreviewOriginRegex);
    if (pattern.test(origin)) {
      return true;
    }
  }
  return false;
}
