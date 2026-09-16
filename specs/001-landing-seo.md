# Spec 001: Public Landing Pages (SEO)

**Status**: implemented
**Author**: Julio
**Created**: 2026-09-14
**Related specs**: 002-auth-users (CTAs link to /login, /register)

## 1. Context & Motivation

CapitalFlow needs a public-facing marketing site to attract users, explain the product,
and rank on search engines. The landing must load fast, be fully indexable, render
without JavaScript, and clearly communicate that the product is an educational
simulator (not a real-money investment platform). This spec covers ONLY the
unauthenticated marketing pages; auth flows are in spec 002.

## 2. User Stories

- As a visitor, I want to understand what CapitalFlow is within 10 seconds of landing.
- As a visitor, I want to understand exactly how the platform works so I can decide if it's for me.
- As a visitor, I want to see pricing (or confirmation that it's free) before signing up.
- As a visitor, I want to know who is behind the product.
- As a visitor searching for "investment simulator" on Google, I want to find CapitalFlow.
- As a visitor, I want a clear CTA to sign up or log in.
- As a visitor on mobile, I want the site to load fast and be fully usable.

## 3. Acceptance Criteria

### Content & structure
- [ ] **AC1**: `/` (home) renders hero, value proposition, 3–4 key features, "How it works" summary, and a primary CTA to `/register`.
- [ ] **AC2**: `/how-it-works` explains the simulator flow in 3–5 numbered steps with icons or diagrams.
- [ ] **AC3**: `/about` describes the mission and — critically — the educational/simulator nature of the product.
- [ ] **AC4**: `/pricing` displays pricing tiers (even if the only tier is "Free — Simulator").
- [ ] **AC5**: Every marketing page includes a visible disclaimer: "Educational investment simulator. No real funds are involved."
- [ ] **AC6**: Every page has a footer with links to `/terms`, `/privacy`, the simulator disclaimer, and copyright.
- [ ] **AC7**: `/terms` and `/privacy` exist as minimum-viable stubs linked from the footer.

### SEO technical
- [ ] **AC8**: All marketing pages are Server Components; render fully without JavaScript (testable with `curl` returning full HTML content).
- [ ] **AC9**: Each page has unique `<title>` and `<meta name="description">` via Next.js Metadata API.
- [ ] **AC10**: Each page has Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`) and Twitter Card tags.
- [ ] **AC11**: `app/sitemap.ts` generates a valid sitemap listing all marketing pages.
- [ ] **AC12**: `app/robots.ts` generates robots.txt allowing indexing of marketing and disallowing `/app/*`.
- [ ] **AC13**: Homepage includes JSON-LD structured data (`@type: WebSite`, `@type: Organization`).
- [ ] **AC14**: All images use Next.js `<Image>` with explicit `width`, `height`, and descriptive `alt` text.
- [ ] **AC15**: Canonical URL tags are set on every page.
- [ ] **AC16**: Pages are served with ISR (`revalidate: 86400`) OR fully static.

### Performance
- [ ] **AC17**: Lighthouse scores on homepage (mobile): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100.
- [ ] **AC18**: Homepage LCP < 2.5s on simulated slow 4G; CLS < 0.1.
- [ ] **AC19**: No client-side JavaScript bundle > 100KB on marketing pages (excluding Next.js framework).

### Accessibility
- [ ] **AC20**: Semantic HTML (`<main>`, `<nav>`, `<section>`, `<footer>`, proper heading hierarchy h1→h2→h3).
- [ ] **AC21**: All interactive elements keyboard-navigable with visible focus states.
- [ ] **AC22**: Color contrast meets WCAG AA on all text.
- [ ] **AC23**: `lang="en"` set on `<html>`.

### Navigation
- [ ] **AC24**: Top nav: Logo (→ `/`), How it works, Pricing, About, "Log in" button (→ `/login`), "Sign up" primary button (→ `/register`).
- [ ] **AC25**: Mobile nav collapses into a hamburger menu, fully keyboard-accessible.

## 4. Technical Contracts

> **Note (2026-09-14)**: `apps/web` scaffolds with the `src/` directory convention
> (`apps/web/src/app`, not `apps/web/app`). Next.js does not allow both `app/` and
> `src/app/` to coexist, so all paths below are rooted at `apps/web/src/` instead
> of `apps/web/`. This corrects the original paths drafted before the scaffold
> commit (`a7908ea chore(web): scaffold Next.js 15 app`).

### Routes (`apps/web/src/app/(marketing)/`)
- `/` → `(marketing)/page.tsx`
- `/how-it-works` → `(marketing)/how-it-works/page.tsx`
- `/about` → `(marketing)/about/page.tsx`
- `/pricing` → `(marketing)/pricing/page.tsx`
- `/terms` → `(marketing)/terms/page.tsx`
- `/privacy` → `(marketing)/privacy/page.tsx`

The `(marketing)` route group isolates layout from the authenticated `(app)` group.

### Shared components (`apps/web/src/components/marketing/`)
- `<MarketingNav />` — top navigation
- `<MarketingFooter />` — footer with disclaimer + legal links
- `<SimulatorBadge />` — visible disclaimer pill, reused on every marketing page
- `<CTAButton />` — primary call-to-action button
- `<FeatureCard />` — reusable card for feature sections
- `<MobileNavToggle />` — client-only hamburger toggle used inside `<MarketingNav />` (the only `"use client"` component in this feature, per CLAUDE.md)

### Metadata
Each page exports `generateMetadata` (or static `metadata`) with:
```ts
{
  title: "...",
  description: "...",
  openGraph: { ... },
  twitter: { card: "summary_large_image", ... },
  alternates: { canonical: "https://capitalflow.example/..." },
}
```

### SEO files
- `apps/web/src/app/sitemap.ts` — default export returns `MetadataRoute.Sitemap`
- `apps/web/src/app/robots.ts` — default export returns `MetadataRoute.Robots`
- `apps/web/src/app/layout.tsx` — sets `lang="en"`, base metadata, viewport

### JSON-LD
Homepage includes `<script type="application/ld+json">` with:
- `Organization` (name, url, logo)
- `WebSite` with `potentialAction: SearchAction` (stubbed for now)

## 5. Edge Cases & Errors

- **JavaScript disabled**: all content readable, CTAs work (links, not click handlers).
- **Slow network**: above-the-fold text renders immediately; below-fold images lazy-loaded.
- **Missing OG image**: fallback to `/og-default.png` at 1200×630.
- **404 pages**: `app/not-found.tsx` with branded 404 and link to home.
- **Locale**: default `en`. Additional languages are out of scope for v1.
- **Dark mode**: follows `prefers-color-scheme` if design supports it; single theme otherwise.

## 6. Out of Scope

- Authentication (spec 002)
- Registration form submission (spec 002; CTA only links to `/register`)
- Blog / content marketing pages
- Multi-language / i18n (v2)
- A/B testing infrastructure
- Analytics integration (deferred to spec 006 deployment)
- Cookie consent banner (compliance spec TBD)
- Live chat widget
- Real pricing / payment logic — this is a free simulator

## 7. Implementation Notes

- Prefer Server Components. `"use client"` only for the mobile nav toggle (minimal client JS).
- Images: Next.js `<Image>` with static imports when possible (automatic blur placeholders).
- Icons: `lucide-react` (tree-shakeable).
- No animation library for v1 — CSS transitions are enough.
- Design tokens live in `tailwind.config.ts` under `theme.extend`.

## 8. Validation Plan

### Automated
- **Unit tests (Vitest)**: snapshot tests for `<MarketingNav />` and `<MarketingFooter />`.
- **E2E (Playwright)**:
  - Home → click "Sign up" → lands on `/register` (even if stub)
  - All marketing nav and footer links resolve without 404
  - `<title>` and meta description present on every page
  - sitemap.xml loads and contains all marketing URLs
  - robots.txt disallows `/app/*`
- **Lighthouse CI**: run on every PR against homepage; fail below AC17 thresholds.
- **Axe accessibility scan**: zero critical violations.

### Manual
- Homepage with JavaScript disabled: all content visible and CTAs work.
- Test on real mobile device (or Chrome devtools mobile emulation).
- View source of homepage: JSON-LD present and validates on https://validator.schema.org.
- Share URL on WhatsApp / Twitter: OG preview renders.

### SEO post-deploy
- Submit sitemap.xml to Google Search Console after deploy.
- Verify indexing within 7 days.
