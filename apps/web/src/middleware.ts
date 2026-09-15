import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_HINT_COOKIE_NAME } from "@capitalflow/shared-types";

/**
 * Protects every `/app/*` route (spec 002 AC39). This only checks for the
 * *presence* of the session-hint cookie, not its validity — presence-only
 * is all this cookie is for, and there's nothing to cryptographically
 * verify even in principle. Real validity/expiry/rotation/revocation state
 * lives only in the API's database against the real refresh token. A
 * present-but-stale hint still lets the request through here;
 * `<AuthProvider>`'s mount-time silent refresh (or a 401-triggered
 * refresh-and-retry) is what actually resolves whether the session is
 * still good, falling back to a client-side redirect to `/login` if not.
 *
 * NOTE: this deliberately checks `AUTH_SESSION_HINT_COOKIE_NAME`, not
 * `AUTH_REFRESH_COOKIE_NAME` — the real refresh-token cookie is scoped to
 * `Path=/auth` (spec 002 AC33) precisely so it's never sent on unrelated
 * routes, which includes `/app/*`. See the comment on
 * `AUTH_SESSION_HINT_COOKIE_NAME` (`@capitalflow/shared-types`) and spec
 * 002's implementation note under AC39 for the two-cookie rationale.
 */
export function middleware(request: NextRequest) {
  const hasSessionHint = request.cookies.has(AUTH_SESSION_HINT_COOKIE_NAME);

  if (hasSessionHint) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "redirect",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*"],
};
