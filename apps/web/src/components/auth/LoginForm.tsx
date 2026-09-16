"use client"; // react-hook-form state + submit handler, navigation on success

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@capitalflow/shared-types";
import { loginRequest } from "@/lib/auth/auth-client";
import { ApiError } from "@/lib/auth/errors";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

// AC38: a single, fixed message on authentication failure — never the raw
// API response text, and never anything that would let a caller infer
// whether "wrong password" or "no such account" was the actual cause.
const GENERIC_AUTH_ERROR = "Incorrect email or password.";
const GENERIC_UNEXPECTED_ERROR =
  "We couldn't log you in. Please try again in a few minutes.";

type LoginFormProps = {
  /** Path to return to after a successful login (spec 002 AC39's `redirect` param). */
  redirectTo?: string;
  /** True when arriving right after a successful registration. */
  justRegistered?: boolean;
};

/**
 * AC36/AC37/AC43: resolver bound to the shared `loginSchema`. Calls
 * `loginRequest` directly (not `useAuth()`) so this page — rendered inside
 * the `(marketing)` route group, per spec 002's routing table — doesn't
 * require an `<AuthProvider>` ancestor; that provider is scoped to the
 * `(app)` layout only (CLAUDE.md: one `<AuthProvider>`, not re-implemented
 * per page). `loginRequest` still writes the token to the same in-memory
 * `token-store` that `<AuthProvider>` reads from once the app navigates
 * into `/app/*`.
 */
export function LoginForm({ redirectTo, justRegistered }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await loginRequest(values);
      router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/app/profile");
    } catch (error) {
      // AC38: any failed login surfaces the same fixed copy, ignoring
      // whatever text/shape the API actually returned.
      const isAuthFailure = error instanceof ApiError && error.status === 401;
      setFormError(isAuthFailure ? GENERIC_AUTH_ERROR : GENERIC_UNEXPECTED_ERROR);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {justRegistered && !formError && (
        <p className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Account created. Please log in.
        </p>
      )}
      <AuthFormError message={formError} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={authLabelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={authInputClass}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className={authFieldErrorClass}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot your password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={authInputClass}
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className={authFieldErrorClass}>
            {errors.password.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
