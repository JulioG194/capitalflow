"use client"; // react-hook-form state + submit handler

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { resetPasswordSchema, type ResetPasswordInput } from "@capitalflow/shared-types";
import { resetPasswordRequest } from "@/lib/auth/auth-client";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

// AC23: the API deliberately doesn't reveal whether a token was invalid or
// expired — the UI mirrors that with a single fixed message for any failure.
const INVALID_TOKEN_ERROR = "This link is invalid or has expired. Request a new one.";

type ResetPasswordFormProps = {
  /** Read server-side from `?token=` by the page (spec 002 section 4). */
  token: string;
};

/** AC36/AC37/AC43: resolver bound to the shared `resetPasswordSchema`. */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetPasswordRequest(values);
      setSucceeded(true);
    } catch {
      setFormError(INVALID_TOKEN_ERROR);
    }
  }

  if (!token) {
    return (
      <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {INVALID_TOKEN_ERROR}{" "}
        <Link href="/forgot-password" className="font-medium underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  if (succeeded) {
    return (
      <p className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Your password was updated.{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthFormError message={formError} />
      <input type="hidden" {...register("token")} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={authLabelClass}>
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className={authInputClass}
          aria-invalid={errors.newPassword ? "true" : "false"}
          aria-describedby={errors.newPassword ? "newPassword-error" : "newPassword-hint"}
          {...register("newPassword")}
        />
        {errors.newPassword ? (
          <p id="newPassword-error" className={authFieldErrorClass}>
            {errors.newPassword.message}
          </p>
        ) : (
          <p id="newPassword-hint" className="text-xs text-ink-muted">
            At least 10 characters, including one letter and one number.
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
