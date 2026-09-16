import type { Metadata } from "next";
import Image from "next/image";
import { LineChart, ShieldCheck, GraduationCap, Wallet } from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { buildHomepageJsonLd } from "@/lib/structured-data";
import { CTAButton } from "@/components/marketing/CTAButton";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Educational investment simulator",
  description:
    "CapitalFlow is an educational investment simulator. Practice with real market data and a simulated portfolio, without risking real money.",
  path: "/",
});

const features = [
  {
    icon: LineChart,
    title: "Real market data",
    description:
      "Follow quotes delayed by up to 15 minutes so you can practice with realistic market prices.",
  },
  {
    icon: Wallet,
    title: "Simulated portfolio",
    description:
      "Buy and sell assets with simulated cash and watch how your portfolio evolves over time.",
  },
  {
    icon: GraduationCap,
    title: "Built for learning",
    description:
      "Every screen is designed to teach investment concepts, not to manage real money.",
  },
  {
    icon: ShieldCheck,
    title: "Zero real risk",
    description:
      "No bank accounts are connected and no real money moves at any point.",
  },
];

export default function HomePage() {
  const jsonLd = buildHomepageJsonLd();

  return (
    <>
      {/* JSON-LD requires dangerouslySetInnerHTML to emit a static <script> (AC13) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="flex flex-col gap-6">
          <SimulatorBadge />
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Learn to invest without risking a single real dollar
          </h1>
          <p className="text-lg text-ink-muted">
            CapitalFlow is an educational simulator: follow real market
            prices, build a simulated portfolio, and practice investment
            decisions in a safe environment designed for learning.
          </p>
          <div className="flex flex-wrap gap-4">
            <CTAButton href="/register">Sign up free</CTAButton>
            <CTAButton href="/how-it-works" variant="secondary" prefetch={false}>
              See how it works
            </CTAButton>
          </div>
        </div>

        <Image
          src="/marketing/hero-illustration.svg"
          alt="Illustration of a rising bar chart representing a simulated portfolio"
          width={480}
          height={360}
          priority
          className="mx-auto w-full max-w-md"
        />
      </section>

      <section
        aria-labelledby="features-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      >
        <h2 id="features-heading" className="text-2xl font-semibold text-ink">
          Why practice with CapitalFlow
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      >
        <h2
          id="how-it-works-heading"
          className="text-2xl font-semibold text-ink"
        >
          How it works, in brief
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Step 1
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Create your account
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Sign up free and receive simulated cash to start practicing.
            </p>
          </li>
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Step 2
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Explore the market
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Check prices with real data (15-minute delay) to decide what to
              simulate.
            </p>
          </li>
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Step 3
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Simulate your decisions
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Buy and sell with simulated cash and track how your portfolio
              evolves.
            </p>
          </li>
        </ol>
        <div className="mt-8">
          <CTAButton href="/how-it-works" variant="secondary">
            See the full process
          </CTAButton>
        </div>
      </section>
    </>
  );
}
