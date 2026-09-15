import Link from "next/link";
import { LEGAL_LINKS, SITE_NAME } from "@/lib/site-config";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

/**
 * Footer with legal links, the simulator disclaimer, and copyright (AC6, AC7).
 * Rendered once in `(marketing)/layout.tsx` so it appears on every marketing
 * page, which is also how AC5's "every page" requirement is satisfied.
 */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
        <SimulatorBadge />
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-ink-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-ink-muted">
          © {year} {SITE_NAME}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
