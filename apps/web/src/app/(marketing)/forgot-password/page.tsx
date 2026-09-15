import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Recuperar contraseña",
  description: "Solicita un enlace para restablecer tu contraseña de CapitalFlow.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Recuperar contraseña
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ingresa tu correo electrónico y te enviaremos un enlace para
          restablecer tu contraseña.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Volver a iniciar sesión
        </Link>
      </p>
    </section>
  );
}
