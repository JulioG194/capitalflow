import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Restablecer contraseña",
  description: "Elige una nueva contraseña para tu cuenta de CapitalFlow.",
  path: "/reset-password",
});

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

// Server Component: reads `?token=` server-side (spec 002 section 4) and
// passes it down to the client form as a prop.
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Restablecer contraseña
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Elige una nueva contraseña para tu cuenta.
        </p>
      </div>

      <ResetPasswordForm token={params.token ?? ""} />
    </section>
  );
}
