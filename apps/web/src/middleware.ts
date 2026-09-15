import { NextResponse, type NextRequest } from "next/server";
import { AUTH_REFRESH_COOKIE_NAME } from "@capitalflow/shared-types";

/**
 * Protects every `/app/*` route (spec 002 AC39). This only checks for the
 * *presence* of the refresh-token cookie, not its validity: refresh tokens
 * are opaque, high-entropy random values (spec 002 section 4/7) — not
 * JWTs — so there is nothing for the Edge runtime to cryptographically
 * verify even in principle. Real validity/expiry/rotation/revocation state
 * lives only in the API's database. A present-but-stale cookie still lets
 * the request through here; `<AuthProvider>`'s mount-time silent refresh
 * (or a 401-triggered refresh-and-retry) is what actually resolves whether
 * the session is still good, falling back to a client-side redirect to
 * `/login` if not.
 */
export function middleware(request: NextRequest) {
  const hasRefreshCookie = request.cookies.has(AUTH_REFRESH_COOKIE_NAME);

  if (hasRefreshCookie) {
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
