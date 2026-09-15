"use client"; // click handler + client-side navigation

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * AC42: calls `POST /auth/logout` (via `useAuth().logout`), clears the
 * in-memory access token, then navigates to `/login`.
 */
export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // AC42/AC19: logout is treated as complete on the client regardless
      // of the network outcome — `logoutRequest` already clears the
      // in-memory token in its own try/finally before this can throw.
    } finally {
      router.push("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}
