import type { Metadata } from "next";
import Image from "next/image";
import { LineChart, ShieldCheck, GraduationCap, Wallet } from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { buildHomepageJsonLd } from "@/lib/structured-data";
import { CTAButton } from "@/components/marketing/CTAButton";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Simulador de inversiones educativo",
  description:
    "CapitalFlow es un simulador de inversiones con fines educativos. Practica con datos de mercado reales y una cartera simulada, sin arriesgar dinero real.",
  path: "/",
});

const features = [
  {
    icon: LineChart,
    title: "Datos de mercado reales",
    description:
      "Sigue cotizaciones con hasta 15 minutos de retraso para practicar con precios de mercado realistas.",
  },
  {
    icon: Wallet,
    title: "Cartera simulada",
    description:
      "Compra y vende activos con saldo simulado y observa cómo evoluciona tu cartera con el tiempo.",
  },
  {
    icon: GraduationCap,
    title: "Pensado para aprender",
    description:
      "Cada pantalla está diseñada para enseñar conceptos de inversión, no para gestionar dinero real.",
  },
  {
    icon: ShieldCheck,
    title: "Cero riesgo real",
    description:
      "No se conectan cuentas bancarias ni se mueve dinero real en ningún momento.",
  },
];

export default function HomePage() {
  const jsonLd = buildHomepageJsonLd();

  return (
    <>
      {/* JSON-LD requires dangerouslySetInnerHTML to emit a static <script> (AC13) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="flex flex-col gap-6">
          <SimulatorBadge />
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Aprende a invertir sin arriesgar un solo peso real
          </h1>
          <p className="text-lg text-ink-muted">
            CapitalFlow es un simulador educativo: sigue precios de mercado
            reales, arma una cartera simulada y practica decisiones de
            inversión en un entorno seguro, pensado para aprender.
          </p>
          <div className="flex flex-wrap gap-4">
            <CTAButton href="/register">Registrarse gratis</CTAButton>
            <CTAButton href="/how-it-works" variant="secondary">
              Ver cómo funciona
            </CTAButton>
          </div>
        </div>

        <Image
          src="/marketing/hero-illustration.svg"
          alt="Ilustración de un gráfico de barras ascendente representando una cartera simulada"
          width={480}
          height={360}
          priority
          className="mx-auto w-full max-w-md"
        />
      </section>

      <section
        aria-labelledby="features-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      >
        <h2 id="features-heading" className="text-2xl font-semibold text-ink">
          Por qué practicar con CapitalFlow
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      >
        <h2
          id="how-it-works-heading"
          className="text-2xl font-semibold text-ink"
        >
          Cómo funciona, en resumen
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Paso 1
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Crea tu cuenta
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Regístrate gratis y recibe un saldo simulado para empezar a
              practicar.
            </p>
          </li>
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Paso 2
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Explora el mercado
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Consulta precios con datos reales (retraso de 15 minutos) para
              decidir qué simular.
            </p>
          </li>
          <li className="rounded-card border border-gray-100 bg-white p-6">
            <span className="text-sm font-semibold text-brand-600">
              Paso 3
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink">
              Simula tus decisiones
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Compra y vende con saldo simulado y sigue la evolución de tu
              cartera.
            </p>
          </li>
        </ol>
        <div className="mt-8">
          <CTAButton href="/how-it-works" variant="secondary">
            Ver el proceso completo
          </CTAButton>
        </div>
      </section>
    </>
  );
}
