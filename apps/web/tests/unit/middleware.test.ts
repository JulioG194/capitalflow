import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_REFRESH_COOKIE_NAME } from "@capitalflow/shared-types";
import { middleware } from "@/middleware";

function requestFor(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(new URL(path, "https://app.example.com"), { headers });
}

describe("middleware", () => {
  it("redirects to /login with a redirect param when the refresh cookie is absent", () => {
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

  it("lets the request through when the refresh cookie is present", () => {
    const response = middleware(
      requestFor("/app/profile", `${AUTH_REFRESH_COOKIE_NAME}=some-opaque-value`),
    );

    // NextResponse.next() has no redirect status/location header.
    expect(response.headers.get("location")).toBeNull();
  });
});
