import type { Metadata } from "next";
import { Check } from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { CTAButton } from "@/components/marketing/CTAButton";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Precios",
  description:
    "CapitalFlow es gratuito: un simulador de inversiones educativo con un único plan, sin costos ni dinero real involucrado.",
  path: "/pricing",
});

const included = [
  "Saldo simulado ilimitado para practicar",
  "Datos de mercado reales con retraso de 15 minutos",
  "Historial completo de tus operaciones simuladas",
  "Seguimiento de la evolución de tu cartera",
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">Precios</h1>
      <p className="mt-4 text-lg text-ink-muted">
        CapitalFlow es y será siempre un simulador educativo gratuito. No hay
        pagos, suscripciones ni dinero real involucrado.
      </p>

      <article className="mt-10 rounded-card border border-brand-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-ink">
          Gratis — Simulador
        </h2>
        <p className="mt-2 text-3xl font-bold text-brand-600">
          $0
          <span className="text-base font-normal text-ink-muted"> / siempre</span>
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <CTAButton href="/register">Registrarse gratis</CTAButton>
        </div>
      </article>

      <div className="mt-8">
        <SimulatorBadge />
      </div>
    </section>
  );
}
