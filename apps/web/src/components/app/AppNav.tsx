import Link from "next/link";
import { SITE_NAME } from "@/lib/site-config";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";
import { LogoutButton } from "@/components/app/LogoutButton";

/**
 * Top navigation for every authenticated `/app/*` page. Server Component —
 * only `<LogoutButton>` needs client interactivity. Always renders the
 * "Modo Simulador" disclaimer (CLAUDE.md hard rule: visible in the nav of
 * every authenticated page), reusing `<SimulatorBadge>` from spec 001
 * rather than duplicating it.
 */
export function AppNav() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <nav
        aria-label="Plataforma"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/app/profile" className="text-lg font-semibold text-ink">
            {SITE_NAME}
          </Link>
          <SimulatorBadge />
        </div>

        <LogoutButton />
      </nav>
    </header>
  );
}
