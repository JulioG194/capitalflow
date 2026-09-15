import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppNav } from "@/components/app/AppNav";

/**
 * Shell for every authenticated `/app/*` route (spec 002 AC39/AC40/AC42).
 *
 * NOTE on this folder's nesting: spec 002's technical contract maps
 * `(app)/profile/page.tsx` to the URL `/app/profile`, and CLAUDE.md's
 * project layout describes the authenticated platform as `/app/market`,
 * `/app/portfolio`, `/app/invest`. A bare `(app)` route group cannot itself
 * add an `/app` URL prefix (route groups are URL-invisible by design, as
 * confirmed by the existing `(marketing)` group mapping `/`, `/about`,
 * etc. with no `/marketing` prefix). To satisfy both documents literally,
 * this file lives at `(app)/app/layout.tsx`: `(app)` is the organizational
 * route group (parallel to `(marketing)`), and the nested literal `app/`
 * segment is what actually produces the `/app/*` URL prefix that
 * `middleware.ts`'s matcher and CLAUDE.md's route list both expect.
 *
 * Mounts the single app-wide `<AuthProvider>` here (CLAUDE.md: one
 * instance, not re-implemented per page) and renders the persistent
 * authenticated nav (Modo Simulador badge + logout, CLAUDE.md hard rule).
 */
export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </AuthProvider>
  );
}
