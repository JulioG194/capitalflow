import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Create account",
  description:
    "Create your free CapitalFlow account, the educational investment simulator.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Create account</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Practice investment decisions without risking real money.
        </p>
      </div>

      <RegisterForm />

      <p className="text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </section>
  );
}
