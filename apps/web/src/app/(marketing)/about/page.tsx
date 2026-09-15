import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SimulatorBadge } from "@/components/marketing/SimulatorBadge";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Nosotros",
  description:
    "CapitalFlow es un proyecto educativo: un simulador de inversiones sin dinero real, creado para que cualquier persona practique conceptos de inversión.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Sobre CapitalFlow
      </h1>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          CapitalFlow nace para resolver un problema común: muchas personas
          quieren aprender a invertir, pero temen equivocarse con su dinero
          mientras lo hacen. Nuestra misión es ofrecer un espacio para
          practicar decisiones de inversión sin ese riesgo.
        </p>

        <h2 className="text-xl font-semibold text-ink">
          Un simulador, no una plataforma de inversión real
        </h2>
        <p>
          CapitalFlow es, ante todo, un simulador con fines educativos. No
          gestionamos cuentas bancarias, no movemos dinero real y no
          garantizamos rendimientos de ningún tipo. Todo el saldo, las
          operaciones y las carteras que ves dentro de la plataforma son
          simulados.
        </p>
        <SimulatorBadge />

        <h2 className="text-xl font-semibold text-ink">Nuestra misión</h2>
        <p>
          Creemos que la mejor forma de aprender sobre mercados financieros es
          practicando, con datos reales y sin miedo a perder dinero. Por eso
          CapitalFlow conecta datos de mercado reales (con retraso) a un
          entorno completamente simulado, para que puedas experimentar,
          equivocarte y aprender.
        </p>
      </div>
    </section>
  );
}
