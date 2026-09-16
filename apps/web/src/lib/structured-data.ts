import { LOGO_URL, SITE_NAME, SITE_URL } from "@/lib/site-config";

/**
 * JSON-LD builders for the homepage (AC13). Kept as plain data builders (not
 * components) so the rendered <script> stays a single, easily-testable element
 * inside `(marketing)/page.tsx` rather than being spread across a component tree.
 */

export function buildOrganizationJsonLd() {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    description:
      "CapitalFlow is an educational investment simulator.",
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    // Stubbed per spec 001 §4 — no live search endpoint exists yet.
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildHomepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [buildOrganizationJsonLd(), buildWebsiteJsonLd()],
  };
}
