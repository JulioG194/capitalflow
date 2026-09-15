"use client"; // holds in-memory auth state and performs browser-only silent-refresh network calls on mount

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { LoginInput, UserDto } from "@capitalflow/shared-types";
import { refreshAccessToken } from "@/lib/auth/api-client";
import { getMe, loginRequest, logoutRequest } from "@/lib/auth/auth-client";
import { getAccessToken, subscribeToAccessToken } from "@/lib/auth/token-store";

interface AuthContextValue {
  /** `null` while logged out or before the initial silent refresh resolves. */
  user: UserDto | null;
  isAuthenticated: boolean;
  /** True until the mount-time silent-refresh attempt has resolved. */
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetches `/auth/me` and updates `user` (used after editing a profile). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function subscribe(listener: () => void) {
  return subscribeToAccessToken(listener);
}

/**
 * Single app-wide auth context (CLAUDE.md anti-pattern: don't re-implement
 * auth per page). Mounted once in `app/(app)/layout.tsx`. On mount it
 * silently attempts `POST /auth/refresh` using the HttpOnly cookie so a
 * returning user with a valid session doesn't have to log in again just
 * because the in-memory access token was lost on a full page reload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Server snapshot is always "no token" — this provider only ever renders
  // inside the client-rendered `(app)` tree, but useSyncExternalStore still
  // requires a getServerSnapshot to be safe under SSR/hydration.
  const hasToken = useSyncExternalStore(
    subscribe,
    () => getAccessToken() !== null,
    () => false,
  );

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    if (mountedRef.current) {
      setUser(me);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // If a token is already in `token-store` (e.g. `LoginForm` just set
      // one and navigated here), there's no need to spend a refresh-token
      // rotation on it — just fetch the profile directly. Otherwise this is
      // a fresh page load: silently try `/auth/refresh` using the HttpOnly
      // cookie before giving up.
      const hasExistingToken = getAccessToken() !== null;
      const refreshed = hasExistingToken || (await refreshAccessToken());
      if (cancelled) return;

      if (!refreshed) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        // Access token was refreshed but /auth/me still failed for some
        // other reason (e.g. transient network error) — fail closed
        // (stay logged-out) rather than surface an error at app boot.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      await loginRequest(input); // sets the in-memory token (AC41)
      await refreshUser(); // fetch the full profile, incl. createdAt (AC26)
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    await logoutRequest(); // AC42: calls POST /auth/logout, clears the token
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: hasToken && user !== null,
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, hasToken, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
