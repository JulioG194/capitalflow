import type { Metadata } from "next";
import { MarketDelayDisclaimer } from "@/components/market/MarketDelayDisclaimer";
import { MarketTicker } from "@/components/market/MarketTicker";
import { MarketIndexCards } from "@/components/market/MarketIndexCards";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketFeaturedTable } from "@/components/market/MarketFeaturedTable";
import { MarketConnectionBanner } from "@/components/market/MarketConnectionBanner";

// Not indexable (robots.ts disallows /app/*, spec 001 AC12) — a minimal
// title is enough, no OG/canonical boilerplate needed here.
export const metadata: Metadata = {
  title: "Market",
};

/**
 * `/app/market` (spec 003). Server Component shell (AC25): renders the
 * static structure — headings, section containers, the AC24 delay
 * disclaimer — with no live price values embedded server-side, so it's
 * visible with no client-side JavaScript required. Each live-data section
 * below is a Client Component that mounts its own skeleton (AC26) until its
 * first `quote:update` arrives. The "Simulator mode" badge is already
 * rendered unconditionally by `<AppNav>` in the shared `(app)/app/layout.tsx`
 * (CLAUDE.md: one badge instance, not reimplemented per page).
 */
export default function MarketPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Market</h1>
        <MarketDelayDisclaimer />
        <MarketConnectionBanner />
      </header>

      <section aria-labelledby="ticker-heading" className="flex flex-col gap-3">
        <h2 id="ticker-heading" className="text-lg font-semibold text-ink">
          Featured stocks
        </h2>
        <MarketTicker />
      </section>

      <section aria-labelledby="indices-heading" className="flex flex-col gap-3">
        <h2 id="indices-heading" className="text-lg font-semibold text-ink">
          Indexes and crypto
        </h2>
        <MarketIndexCards />
      </section>

      <section aria-labelledby="chart-heading" className="flex flex-col gap-3">
        <h2 id="chart-heading" className="text-lg font-semibold text-ink">
          Price chart
        </h2>
        <MarketChart />
      </section>

      <section aria-labelledby="table-heading" className="flex flex-col gap-3">
        <h2 id="table-heading" className="text-lg font-semibold text-ink">
          Watchlist
        </h2>
        <MarketFeaturedTable />
      </section>
    </div>
  );
}
