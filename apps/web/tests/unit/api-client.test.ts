import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, refreshAccessToken } from "@/lib/auth/api-client";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-store";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the Authorization header when a token is present", async () => {
    setAccessToken("valid-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/auth/me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
  });

  it("silently refreshes once and retries the original request after a 401", async () => {
    setAccessToken("expired-token");
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(jsonResponse({ accessToken: "new-token" }));
      }
      return Promise.resolve(
        getAccessToken() === "new-token"
          ? jsonResponse({ id: "1" })
          : jsonResponse({ message: "Unauthorized" }, 401),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(200);
    expect(getAccessToken()).toBe("new-token");
    // 1) original request (401) 2) refresh 3) retried original request
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("dedupes concurrent refresh calls into a single network request", async () => {
    let refreshCalls = 0;
    setAccessToken("expired-token");
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse({ accessToken: "new-token" }));
      }
      return Promise.resolve(jsonResponse({ id: "1" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);

    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe("new-token");
  });

  it("gives up and returns the original 401 response when refresh also fails", async () => {
    setAccessToken("expired-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(401);
    expect(getAccessToken()).toBeNull();
  });
});
