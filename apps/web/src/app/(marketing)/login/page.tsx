import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Log in",
  description:
    "Log in to your CapitalFlow account, the educational investment simulator.",
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
        <h1 className="text-3xl font-bold tracking-tight text-ink">Log in</h1>
        <p className="mt-2 text-sm text-ink-muted">Access your simulated portfolio.</p>
      </div>

      <LoginForm
        redirectTo={params.redirect}
        justRegistered={params.registered === "1"}
      />

      <p className="text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Sign up
        </Link>
      </p>
    </section>
  );
}
