"use client"; // react-hook-form state + submit handler

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@capitalflow/shared-types";
import { forgotPasswordRequest } from "@/lib/auth/auth-client";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

const GENERIC_ERROR =
  "We couldn't process your request. Please try again in a few minutes.";
// AC20/AC21: the API always returns this same message whether or not the
// email exists — the UI must never imply otherwise by showing anything else.
const SENT_MESSAGE =
  "If that email exists in our system, we sent a link to reset your password.";

/** AC36/AC37/AC43: resolver bound to the shared `forgotPasswordSchema`. */
export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    setDevResetLink(null);
    try {
      const result = await forgotPasswordRequest(values);
      // Spec 006 AC28: non-prod API may echo resetLink — show it for local
      // demos only. Production never returns this field.
      if (typeof result.resetLink === "string" && result.resetLink.length > 0) {
        setDevResetLink(result.resetLink);
      }
      setSent(true);
    } catch {
      setFormError(GENERIC_ERROR);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {SENT_MESSAGE}
        </p>
        {devResetLink ? (
          <p className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Development mode:{" "}
            <a href={devResetLink} className="font-medium underline">
              open reset link
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
