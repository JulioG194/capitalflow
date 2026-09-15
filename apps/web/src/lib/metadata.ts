import type { Metadata } from "next";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site-config";

export type PageMetadataInput = {
  /** Page-specific title. The root layout applies the "%s | CapitalFlow" template. */
  title: string;
  description: string;
  /** Path starting with "/", e.g. "/how-it-works". Used for canonical + og:url. */
  path: string;
};

/**
 * Builds a Next.js `Metadata` object (title, description, canonical, Open Graph,
 * Twitter Card) for a single marketing page from a minimal input. Centralizing
 * this keeps every marketing page.tsx's metadata export consistent (AC9, AC10,
 * AC15) without duplicating the OG/Twitter boilerplate six times.
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "es_ES",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}
