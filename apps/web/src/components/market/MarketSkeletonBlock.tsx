type MarketSkeletonBlockProps = {
  className?: string;
  "aria-label"?: string;
};

/**
 * Shared shimmering placeholder for market sections before their first
 * `quote:update` arrives (AC26: never render a blank, zero, or fabricated
 * value while waiting for live data). Pure markup, no client-only APIs, so
 * it's safe to import from both Server and Client Components.
 */
export function MarketSkeletonBlock({
  className = "",
  "aria-label": ariaLabel,
}: MarketSkeletonBlockProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`animate-pulse rounded-card bg-gray-100 ${className}`}
    >
      <span className="sr-only">Loading market data…</span>
    </div>
  );
}
