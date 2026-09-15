import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_SESSION_HINT_COOKIE_NAME,
} from "@capitalflow/shared-types";
import { middleware } from "@/middleware";

function requestFor(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(new URL(path, "https://app.example.com"), { headers });
}

describe("middleware", () => {
  it("redirects to /login with a redirect param when the session-hint cookie is absent", () => {
    const response = middleware(requestFor("/app/profile"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/app/profile");
  });

  it("preserves the query string of the originally requested path", () => {
    const response = middleware(requestFor("/app/portfolio?tab=history"));

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/app/portfolio?tab=history");
  });

  it("lets the request through when the session-hint cookie is present", () => {
    const response = middleware(
      requestFor("/app/profile", `${AUTH_SESSION_HINT_COOKIE_NAME}=1`),
    );

    // NextResponse.next() has no redirect status/location header.
    expect(response.headers.get("location")).toBeNull();
  });

  // Regression test for the bug this file's previous version masked: the
  // real refresh-token cookie is scoped to `Path=/auth` (spec 002 AC33), so
  // a real browser NEVER sends it on a `/app/*` request — only the
  // `Path=/` session-hint cookie is actually visible here. Fabricating the
  // refresh cookie on this request (as the old version of this test did)
  // describes a scenario that can't occur in a real browser, and it must
  // still redirect.
  it("still redirects when only the (real-world-impossible-here) refresh cookie is present, not the session hint", () => {
    const response = middleware(
      requestFor("/app/profile", `${AUTH_REFRESH_COOKIE_NAME}=some-opaque-value`),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });
});
