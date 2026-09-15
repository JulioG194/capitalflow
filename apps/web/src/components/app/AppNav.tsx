import Link from "next/link";
import { SITE_NAME } from "@/lib/site-config";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";
import { LogoutButton } from "@/components/app/LogoutButton";
import { AppNavLinks } from "@/components/app/AppNavLinks";

/**
 * Top navigation for every authenticated `/app/*` page. Server Component —
 * only `<AppNavLinks>` and `<LogoutButton>` need client interactivity.
 * Always renders the "Modo Simulador" disclaimer (CLAUDE.md hard rule:
 * visible in the nav of every authenticated page), reusing
 * `<SimulatorBadge>` from spec 001 rather than duplicating it.
 */
export function AppNav() {
  return (
    <header className="relative border-b border-gray-100 bg-white">
      <nav
        aria-label="Plataforma"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Link href="/app/portfolio" className="text-lg font-semibold text-ink">
            {SITE_NAME}
          </Link>
          <SimulatorBadge />
        </div>

        <AppNavLinks />

        <LogoutButton />
      </nav>
    </header>
  );
}
