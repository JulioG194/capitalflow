import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Crear cuenta",
  description:
    "Crea tu cuenta gratuita en CapitalFlow, el simulador de inversiones con fines educativos.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Crear cuenta</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Practica decisiones de inversión sin arriesgar dinero real.
        </p>
      </div>

      <RegisterForm />

      <p className="text-sm text-ink-muted">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Inicia sesión
        </Link>
      </p>
    </section>
  );
}
