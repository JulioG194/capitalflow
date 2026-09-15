import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Iniciar sesión",
  description:
    "Inicia sesión en tu cuenta de CapitalFlow, el simulador de inversiones con fines educativos.",
  path: "/login",
});

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; registered?: string }>;
};

// Server Component: reads the `redirect`/`registered` query params (spec 002
// AC39) server-side and hands them to the client `<LoginForm>` as props,
// so the form itself doesn't need `useSearchParams()`/a Suspense boundary.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-ink-muted">Accede a tu cartera simulada.</p>
      </div>

      <LoginForm
        redirectTo={params.redirect}
        justRegistered={params.registered === "1"}
      />

      <p className="text-sm text-ink-muted">
        ¿No tienes una cuenta?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Regístrate
        </Link>
      </p>
    </section>
  );
}
