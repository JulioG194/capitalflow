import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site-config";

describe("buildPageMetadata", () => {
  it("produces title, description, canonical, Open Graph, and Twitter fields (AC9, AC10, AC15)", () => {
    const metadata = buildPageMetadata({
      title: "Cómo funciona",
      description: "Descripción de prueba",
      path: "/how-it-works",
    });

    expect(metadata.title).toBe("Cómo funciona");
    expect(metadata.description).toBe("Descripción de prueba");
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/how-it-works`);

    expect(metadata.openGraph?.title).toBe("Cómo funciona");
    expect(metadata.openGraph?.description).toBe("Descripción de prueba");
    expect(metadata.openGraph).toHaveProperty("url", `${SITE_URL}/how-it-works`);
    expect(metadata.openGraph).toHaveProperty("type", "website");
    expect(metadata.openGraph?.images).toBeTruthy();

    // `twitter` is a discriminated union in Next's Metadata type; narrow via
    // an `in` check rather than an `any`/unchecked cast before asserting.
    const { twitter } = metadata;
    expect(twitter && "card" in twitter ? twitter.card : undefined).toBe(
      "summary_large_image",
    );
    expect(twitter && "title" in twitter ? twitter.title : undefined).toBe(
      "Cómo funciona",
    );
  });

  it("produces distinct canonical URLs per path", () => {
    const home = buildPageMetadata({
      title: "Inicio",
      description: "d",
      path: "/",
    });
    const pricing = buildPageMetadata({
      title: "Precios",
      description: "d",
      path: "/pricing",
    });

    expect(home.alternates?.canonical).not.toBe(pricing.alternates?.canonical);
  });
});
