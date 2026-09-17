import { API_URL } from "@/lib/env";
import { getAccessToken, setAccessToken } from "./token-store";
import { reportApiFailure, reportApiSuccess } from "@/lib/api-health";

/**
 * Base fetch for `/auth/*` endpoints that do NOT go through the
 * access-token refresh-and-retry loop below (register, login, refresh
 * itself, logout, forgot/reset-password). Always sends
 * `credentials: "include"` so the HttpOnly refresh cookie travels with
 * login/refresh/logout requests (spec 002 section 4).
 *
 * Also feeds the cold-start banner (spec 006 AC23): network errors and
 * 502/503 within the first 60s of the session flip the "waking up"
 * indicator; any successful response clears it.
 */
export function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: "include" }).then(
    (response) => {
      if (response.status === 502 || response.status === 503) {
        reportApiFailure(response.status);
      } else {
        reportApiSuccess();
      }
      return response;
    },
    (error: unknown) => {
      reportApiFailure();
      throw error;
    },
  );
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Performs `POST /auth/refresh` at most once at a time (module-level
 * single-flight guard), regardless of how many callers ask for it
 * concurrently. This matters because the API's reuse-detection (spec 002
 * AC14/AC16) treats a second use of the same refresh cookie as a replay
 * attack and revokes the whole session — so two components independently
 * racing a refresh call must never happen. Exported so `<AuthProvider>` can
 * also call it directly on mount to silently restore a session.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<boolean> {
  try {
    const response = await authFetch("/auth/refresh", { method: "POST" });
    if (!response.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await response.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

/**
 * Fetch wrapper for Bearer-protected endpoints (currently `/auth/me`).
 * Attaches the in-memory access token; on a `401` it silently refreshes
 * once and retries the original request exactly once before giving up
 * (spec 002, Edge Cases: "Access token expires mid-session").
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return authFetch(path, { ...init, headers });
  };

  const response = await attempt();
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  return attempt();
}
