import type { Metadata } from "next";
import {
  UserPlus,
  Wallet,
  LineChart,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { CTAButton } from "@/components/marketing/CTAButton";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "How it works",
  description:
    "See CapitalFlow's investment simulator flow in 5 steps: sign up, receive simulated cash, explore the market, simulate trades, and review your portfolio.",
  path: "/how-it-works",
});

const steps = [
  {
    icon: UserPlus,
    title: "1. Create your account",
    description:
      "Sign up with your email. No bank or payment details are requested: this is a free educational simulator.",
  },
  {
    icon: Wallet,
    title: "2. Receive simulated cash",
    description:
      "Your account starts with simulated cash so you can begin practicing immediately, with no real money involved.",
  },
  {
    icon: LineChart,
    title: "3. Explore the market",
    description:
      "Check asset quotes with real data (delayed by up to 15 minutes) to decide what you want to simulate.",
  },
  {
    icon: ArrowLeftRight,
    title: "4. Simulate your trades",
    description:
      "Buy and sell with your simulated cash. Every trade is recorded so you can review your decisions later.",
  },
  {
    icon: BarChart3,
    title: "5. Review your portfolio",
    description:
      "Track how your simulated portfolio evolves over time and learn from your decisions with no real risk.",
  },
];

export default function HowItWorksPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        How CapitalFlow works
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        A simple path designed to teach investing by practicing with a
        simulated portfolio, not with real money.
      </p>

      <ol className="mt-10 flex flex-col gap-6">
        {steps.map((step) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-card border border-gray-100 bg-white p-6"
          >
            <step.icon
              aria-hidden="true"
              className="h-8 w-8 shrink-0 text-brand-600"
            />
            <div>
              <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <CTAButton href="/register">Sign up free</CTAButton>
      </div>
    </section>
  );
}
