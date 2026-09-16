import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTAButton } from "@/components/marketing/CTAButton";

/**
 * Branded 404 (spec 001 §5 edge case). Reuses the marketing nav/footer so a
 * mistyped URL still feels like part of the site, with a clear way back home.
 */
export default function NotFound() {
  return (
    <>
      <MarketingNav />
      <main>
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
          <p className="text-sm font-semibold text-brand-600">Error 404</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            We couldn&apos;t find this page
          </h1>
          <p className="text-ink-muted">
            The link may be broken or the page may have moved. Head home to
            keep exploring CapitalFlow.
          </p>
          <CTAButton href="/">Back to home</CTAButton>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
