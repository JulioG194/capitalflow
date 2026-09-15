/**
 * Single source of truth for marketing-site constants: canonical URLs, nav/footer
 * link sets, and shared SEO defaults. Consumed by `lib/metadata.ts`, `sitemap.ts`,
 * `robots.ts`, and the marketing nav/footer components so URLs and copy never
 * drift between files.
 */

export const SITE_NAME = "CapitalFlow";

/**
 * Base URL used for canonical links, sitemap entries, and Open Graph `og:url`.
 * Overridable via `NEXT_PUBLIC_SITE_URL` for staging/preview deploys; falls back
 * to the production placeholder domain referenced in the spec.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://capitalflow.example";

export const SITE_DESCRIPTION =
  "Simulador de inversiones con fines educativos. Practica decisiones de inversión con datos de mercado reales, sin arriesgar dinero real.";

export const DISCLAIMER_TEXT =
  "Simulador de inversiones con fines educativos. No se manejan fondos reales.";

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-default.png`,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — simulador de inversiones educativo`,
};

export const LOGO_URL = `${SITE_URL}/logo.svg`;

export type NavLink = {
  href: string;
  label: string;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/how-it-works", label: "Cómo funciona" },
  { href: "/pricing", label: "Precios" },
  { href: "/about", label: "Nosotros" },
];

/** Authenticated platform nav (`/app/*`). Distinct from marketing `NAV_LINKS`. */
export const APP_NAV_LINKS: NavLink[] = [
  { href: "/app/market", label: "Mercado" },
  { href: "/app/portfolio", label: "Mi cartera" },
  { href: "/app/invest", label: "Invertir" },
  { href: "/app/profile", label: "Perfil" },
];

export const LEGAL_LINKS: NavLink[] = [
  { href: "/terms", label: "Términos de servicio" },
  { href: "/privacy", label: "Privacidad" },
];

export const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
] as const;
