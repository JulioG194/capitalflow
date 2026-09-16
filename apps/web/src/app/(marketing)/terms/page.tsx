import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/site-config";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "CapitalFlow Terms of Service: an educational investment simulator, with no real money and no guaranteed returns.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Last updated: initial version (document in progress).
      </p>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          {SITE_NAME} is an educational investment simulator. By using the
          platform you accept that no real money is deposited, transferred,
          invested, or managed on your behalf.
        </p>

        <h2 className="text-xl font-semibold text-ink">Nature of the service</h2>
        <p>
          All balances, portfolios, trades, and results you see inside{" "}
          {SITE_NAME} are simulated for educational purposes. They do not
          represent real money and do not constitute financial advice.
        </p>

        <h2 className="text-xl font-semibold text-ink">No guarantees</h2>
        <p>
          {SITE_NAME} does not promise or guarantee returns, profits, or
          results of any kind, real or simulated.
        </p>

        <p className="text-sm">
          This document is an initial stub and will be expanded in a later
          version of the product.
        </p>
      </div>
    </section>
  );
}
