import type { Metadata } from "next";
import { InvestDisclaimer } from "@/components/app/invest/InvestDisclaimer";
import { RendimientoCalculator } from "@/components/app/invest/RendimientoCalculator";
import { InvestForm } from "@/components/app/invest/InvestForm";

// Not indexable (robots.ts disallows /app/*, spec 001 AC12) — a minimal
// title is enough, no OG/canonical boilerplate needed here.
export const metadata: Metadata = {
  title: "Invest",
};

/**
 * `/app/invest` (spec 005). Server Component shell (AC33): renders the
 * static structure — heading, section containers, the simulated-investing
 * disclaimer — with no live financial value embedded server-side. The
 * platform-wide "Simulator mode" badge is already rendered unconditionally
 * by `<AppNav>` in the shared `(app)/app/layout.tsx` (CLAUDE.md: one badge
 * instance, not reimplemented per page); this page adds its own visible
 * disclaimer on top of it (AC19, AC33). Both data-bearing sections below are
 * independent `"use client"` components responsible for fetching/holding
 * their own state, because the access token exists only in memory in the
 * browser (spec 002 AC41) and a Server Component cannot attach it to a
 * request. Unauthenticated access is already redirected to `/login` by the
 * existing `/app/:path*` middleware matcher (AC34 — no new middleware logic
 * introduced by this spec).
 */
export default function InvestPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Invest</h1>
        <InvestDisclaimer />
      </header>

      <section aria-labelledby="calculator-heading" className="flex flex-col gap-3">
        <h2 id="calculator-heading" className="text-lg font-semibold text-ink">
          Return calculator
        </h2>
        <RendimientoCalculator />
      </section>

      <section aria-labelledby="invest-form-heading" className="flex flex-col gap-3">
        <h2 id="invest-form-heading" className="text-lg font-semibold text-ink">
          New simulated investment
        </h2>
        <InvestForm />
      </section>
    </div>
  );
}
