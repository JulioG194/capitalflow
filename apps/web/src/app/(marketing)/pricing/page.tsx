import type { Metadata } from "next";
import { Check } from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { CTAButton } from "@/components/marketing/CTAButton";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "CapitalFlow is free: an educational investment simulator with a single plan, no fees, and no real money involved.",
  path: "/pricing",
});

const included = [
  "Unlimited simulated cash to practice with",
  "Real market data with a 15-minute delay",
  "Full history of your simulated trades",
  "Portfolio performance tracking",
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">Pricing</h1>
      <p className="mt-4 text-lg text-ink-muted">
        CapitalFlow is and will always be a free educational simulator. There
        are no payments, subscriptions, or real money involved.
      </p>

      <article className="mt-10 rounded-card border border-brand-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-ink">
          Free — Simulator
        </h2>
        <p className="mt-2 text-3xl font-bold text-brand-600">
          $0
          <span className="text-base font-normal text-ink-muted"> / forever</span>
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <CTAButton href="/register">Sign up free</CTAButton>
        </div>
      </article>

      <div className="mt-8">
        <SimulatorBadge />
      </div>
    </section>
  );
}
