import Link from "next/link";
import Image from "next/image";
import { NAV_LINKS, SITE_NAME } from "@/lib/site-config";
import { CTAButton } from "@/components/marketing/CTAButton";
import { MobileNavToggle } from "@/components/marketing/MobileNavToggle";

/**
 * Top navigation (AC24). Server Component — only the hamburger panel
 * (`<MobileNavToggle />`) ships client JS; everything here renders and
 * navigates with plain links even without JavaScript (AC8).
 */
export function MarketingNav() {
  return (
    <header className="relative border-b border-gray-100 bg-white">
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-ink"
        >
          <Image
            src="/logo.svg"
            alt={`Logotipo de ${SITE_NAME}`}
            width={32}
            height={32}
            priority
          />
          <span>{SITE_NAME}</span>
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              {/* prefetch={false}: these are secondary destinations always
                  visible above the fold; not prefetching them keeps initial
                  bandwidth free for the hero image/fonts (AC18 LCP budget). */}
              <Link
                href={link.href}
                prefetch={false}
                className="text-sm font-medium text-ink-muted hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            prefetch={false}
            className="text-sm font-medium text-ink hover:text-brand-600"
          >
            Iniciar sesión
          </Link>
          <CTAButton href="/register">Registrarse</CTAButton>
        </div>

        <MobileNavToggle links={NAV_LINKS} />
      </nav>
    </header>
  );
}
