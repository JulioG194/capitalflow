import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/site-config";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Términos de servicio",
  description:
    "Términos de servicio de CapitalFlow: un simulador de inversiones educativo, sin dinero real ni garantía de rendimientos.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Términos de servicio
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Última actualización: versión inicial (documento en construcción).
      </p>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          {SITE_NAME} es un simulador de inversiones con fines educativos. Al
          usar la plataforma aceptas que ninguna cantidad de dinero real es
          depositada, transferida, invertida o gestionada en tu nombre.
        </p>

        <h2 className="text-xl font-semibold text-ink">Naturaleza del servicio</h2>
        <p>
          Todos los saldos, carteras, operaciones y resultados que veas dentro
          de {SITE_NAME} son simulados con fines educativos. No representan
          dinero real ni constituyen asesoría financiera.
        </p>

        <h2 className="text-xl font-semibold text-ink">Sin garantías</h2>
        <p>
          {SITE_NAME} no promete ni garantiza rendimientos, ganancias ni
          resultados de ningún tipo, reales o simulados.
        </p>

        <p className="text-sm">
          Este documento es un stub inicial y será ampliado en una versión
          posterior del producto.
        </p>
      </div>
    </section>
  );
}
