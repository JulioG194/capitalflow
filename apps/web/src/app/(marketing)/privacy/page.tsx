import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/site-config";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Privacidad",
  description:
    "Política de privacidad de CapitalFlow: qué datos recopilamos y cómo los usamos dentro de este simulador de inversiones educativo.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-ink">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Última actualización: versión inicial (documento en construcción).
      </p>

      <div className="mt-8 flex flex-col gap-6 text-ink-muted">
        <p>
          {SITE_NAME} recopila únicamente los datos necesarios para operar tu
          cuenta simulada: datos de registro y el historial de tus
          operaciones simuladas dentro de la plataforma.
        </p>

        <h2 className="text-xl font-semibold text-ink">Qué no hacemos</h2>
        <p>
          No solicitamos ni almacenamos datos bancarios ni de tarjetas de
          pago, porque {SITE_NAME} nunca gestiona dinero real.
        </p>

        <h2 className="text-xl font-semibold text-ink">Datos de mercado</h2>
        <p>
          Los precios de mercado que se muestran provienen de un proveedor de
          datos externo y se usan únicamente para fines educativos dentro del
          simulador.
        </p>

        <p className="text-sm">
          Este documento es un stub inicial y será ampliado en una versión
          posterior del producto.
        </p>
      </div>
    </section>
  );
}
