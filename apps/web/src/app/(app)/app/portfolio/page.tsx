import type { Metadata } from "next";
import { PortfolioDisclaimer } from "@/components/app/portfolio/PortfolioDisclaimer";
import { PortfolioSummary } from "@/components/app/portfolio/PortfolioSummary";
import { PortfolioAllocationChart } from "@/components/app/portfolio/PortfolioAllocationChart";
import { HoldingsTable } from "@/components/app/portfolio/HoldingsTable";
import { TransactionHistory } from "@/components/app/portfolio/TransactionHistory";

// Not indexable (robots.ts disallows /app/*, spec 001 AC12) — a minimal
// title is enough, no OG/canonical boilerplate needed here.
export const metadata: Metadata = {
  title: "My portfolio",
};

/**
 * `/app/portfolio` (spec 004). Server Component shell (AC22): renders the
 * static structure — headings, section containers, the simulated-figures
 * disclaimer — with no live financial value embedded server-side. The
 * platform-wide "Simulator mode" badge is already rendered unconditionally
 * by `<AppNav>` in the shared `(app)/app/layout.tsx` (CLAUDE.md: one badge
 * instance, not reimplemented per page). Each data section below is an
 * independent `"use client"` component responsible for fetching its own
 * data (AC22a), because the access token exists only in memory in the
 * browser (spec 002 AC41) and a Server Component cannot attach it to a
 * request.
 */
export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">My portfolio</h1>
        <PortfolioDisclaimer />
      </header>

      <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
        <h2 id="summary-heading" className="text-lg font-semibold text-ink">
          Summary
        </h2>
        <PortfolioSummary />
      </section>

      <section aria-labelledby="allocation-heading" className="flex flex-col gap-3">
        <h2 id="allocation-heading" className="text-lg font-semibold text-ink">
          Asset allocation
        </h2>
        <PortfolioAllocationChart />
      </section>

      <section aria-labelledby="holdings-heading" className="flex flex-col gap-3">
        <h2 id="holdings-heading" className="text-lg font-semibold text-ink">
          Active holdings
        </h2>
        <HoldingsTable />
      </section>

      <section aria-labelledby="transactions-heading" className="flex flex-col gap-3">
        <h2 id="transactions-heading" className="text-lg font-semibold text-ink">
          Transaction history
        </h2>
        <TransactionHistory />
      </section>
    </div>
  );
}
