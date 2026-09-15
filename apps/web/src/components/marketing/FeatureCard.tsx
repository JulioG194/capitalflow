import type { LucideIcon } from "lucide-react";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Reusable card for feature/benefit sections (home) and pricing tiers.
 * `title` renders as an `<h3>` — callers are responsible for nesting these
 * under a preceding `<h2>` to keep the heading hierarchy intact (AC20).
 */
export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="rounded-card border border-gray-100 bg-white p-6 shadow-sm">
      <Icon aria-hidden="true" className="h-8 w-8 text-brand-600" />
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{description}</p>
    </article>
  );
}
