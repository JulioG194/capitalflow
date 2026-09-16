import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = buildPageMetadata({
  title: "Forgot password",
  description: "Request a link to reset your CapitalFlow password.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Forgot password
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your email and we will send you a link to reset your password.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to log in
        </Link>
      </p>
    </section>
  );
}
