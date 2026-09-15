import Link from "next/link";
import type { ReactNode } from "react";

type CTAButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  /** Set false for above-the-fold secondary CTAs to reduce initial network
   * contention with the LCP resource on slow connections (AC18). Defaults
   * to Next's normal viewport prefetch behavior. */
  prefetch?: boolean;
};

/**
 * Primary call-to-action button. Always a real `<Link>` (not a client-side
 * `onClick` handler) so it works with JavaScript disabled (AC8) and is
 * keyboard/focus accessible by default (AC21).
 */
export function CTAButton({
  href,
  children,
  variant = "primary",
  className = "",
  prefetch,
}: CTAButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-card px-5 py-2.5 text-sm font-semibold transition-colors";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary:
      "border border-brand-600 text-brand-700 hover:bg-brand-50",
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
