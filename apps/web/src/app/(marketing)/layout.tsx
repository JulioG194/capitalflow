import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

/**
 * Shared chrome for every unauthenticated marketing page: top nav, a single
 * <main> landmark for page content, and the footer (AC6, AC20). Isolated from
 * the authenticated `(app)` route group, which will get its own layout.
 */
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </>
  );
}
