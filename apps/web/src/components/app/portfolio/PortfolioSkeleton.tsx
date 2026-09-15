type PortfolioSkeletonProps = {
  className?: string;
  label: string;
};

/**
 * Shared loading placeholder for `/app/portfolio`'s independent
 * data-fetching sections (AC23: never render a blank section or a
 * fabricated `$0.00`/`0%` while a request is in flight). Pure markup, no
 * client-only APIs, so it's safe to import from any client component —
 * mirrors `components/market/MarketSkeletonBlock.tsx`'s pattern.
 */
export function PortfolioSkeleton({ className = "h-24 rounded-card", label }: PortfolioSkeletonProps) {
  return (
    <div role="status" aria-label={label} className={`animate-pulse bg-gray-100 ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
