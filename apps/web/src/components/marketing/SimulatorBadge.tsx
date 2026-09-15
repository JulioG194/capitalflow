import { DISCLAIMER_TEXT } from "@/lib/site-config";

type SimulatorBadgeProps = {
  className?: string;
};

/**
 * Visible "this is a simulator, no real money" disclaimer pill (AC5). Rendered
 * inside `<MarketingFooter />` so it appears on every marketing page, and again
 * near the homepage hero for immediate clarity.
 */
export function SimulatorBadge({ className = "" }: SimulatorBadgeProps) {
  return (
    <p
      role="note"
      className={`inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 ${className}`}
    >
      {DISCLAIMER_TEXT}
    </p>
  );
}
