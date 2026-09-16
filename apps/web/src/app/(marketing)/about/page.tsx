import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description:
    "CapitalFlow is an educational project: an investment simulator with no real money, built so anyone can practice investment concepts.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        About CapitalFlow
      </h1>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          CapitalFlow exists to solve a common problem: many people want to
          learn to invest, but are afraid of making mistakes with their money
          while they do. Our mission is to offer a space to practice
          investment decisions without that risk.
        </p>

        <h2 className="text-xl font-semibold text-ink">
          A simulator, not a real investment platform
        </h2>
        <p>
          CapitalFlow is, first and foremost, an educational simulator. We do
          not manage bank accounts, we do not move real money, and we do not
          guarantee returns of any kind. Every balance, trade, and portfolio
          you see on the platform is simulated.
        </p>
        <SimulatorBadge />

        <h2 className="text-xl font-semibold text-ink">Our mission</h2>
        <p>
          We believe the best way to learn about financial markets is by
          practicing, with real data and without fear of losing money. That
          is why CapitalFlow connects real market data (delayed) to a fully
          simulated environment, so you can experiment, make mistakes, and
          learn.
        </p>
      </div>
    </section>
  );
}
