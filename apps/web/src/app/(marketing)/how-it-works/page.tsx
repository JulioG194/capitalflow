import type { Metadata } from "next";
import {
  UserPlus,
  Wallet,
  LineChart,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/metadata";
import { CTAButton } from "@/components/marketing/CTAButton";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Cómo funciona",
  description:
    "Conoce el flujo del simulador de inversiones de CapitalFlow en 5 pasos: regístrate, recibe saldo simulado, explora el mercado, simula operaciones y revisa tu cartera.",
  path: "/how-it-works",
});

const steps = [
  {
    icon: UserPlus,
    title: "1. Crea tu cuenta",
    description:
      "Regístrate con tu correo electrónico. No se solicitan datos bancarios ni de pago: es un simulador educativo, gratuito.",
  },
  {
    icon: Wallet,
    title: "2. Recibe saldo simulado",
    description:
      "Tu cuenta arranca con un saldo simulado para que puedas empezar a practicar de inmediato, sin dinero real de por medio.",
  },
  {
    icon: LineChart,
    title: "3. Explora el mercado",
    description:
      "Consulta cotizaciones de activos con datos reales (retraso de hasta 15 minutos) para decidir qué te interesa simular.",
  },
  {
    icon: ArrowLeftRight,
    title: "4. Simula tus operaciones",
    description:
      "Compra y vende con tu saldo simulado. Cada operación se registra para que puedas revisar tus decisiones después.",
  },
  {
    icon: BarChart3,
    title: "5. Revisa tu cartera",
    description:
      "Sigue la evolución de tu cartera simulada con el tiempo y aprende de tus decisiones sin ningún riesgo real.",
  },
];

export default function HowItWorksPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Cómo funciona CapitalFlow
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Un recorrido simple, pensado para aprender a invertir practicando con
        una cartera simulada, no con dinero real.
      </p>

      <ol className="mt-10 flex flex-col gap-6">
        {steps.map((step) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-card border border-gray-100 bg-white p-6"
          >
            <step.icon
              aria-hidden="true"
              className="h-8 w-8 shrink-0 text-brand-600"
            />
            <div>
              <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <CTAButton href="/register">Registrarse gratis</CTAButton>
      </div>
    </section>
  );
}
