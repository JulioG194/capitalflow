import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/site-config";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy",
  description:
    "CapitalFlow privacy policy: what data we collect and how we use it inside this educational investment simulator.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Privacy policy
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Last updated: initial version (document in progress).
      </p>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          {SITE_NAME} collects only the data needed to operate your
          simulated account: registration details and the history of your
          simulated trades on the platform.
        </p>

        <h2 className="text-xl font-semibold text-ink">What we do not do</h2>
        <p>
          We do not request or store bank or payment-card data, because{" "}
          {SITE_NAME} never handles real money.
        </p>

        <h2 className="text-xl font-semibold text-ink">Market data</h2>
        <p>
          Market prices shown come from an external data provider and are
          used solely for educational purposes inside the simulator.
        </p>

        <p className="text-sm">
          This document is an initial stub and will be expanded in a later
          version of the product.
        </p>
      </div>
    </section>
  );
}
