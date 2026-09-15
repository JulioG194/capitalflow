"use client"; // react-hook-form state + submit handler

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@capitalflow/shared-types";
import { forgotPasswordRequest } from "@/lib/auth/auth-client";
import { translateFieldError } from "@/lib/auth/error-messages";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

const GENERIC_ERROR =
  "No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos.";
// AC20/AC21: the API always returns this same message whether or not the
// email exists — the UI must never imply otherwise by showing anything else.
const SENT_MESSAGE =
  "Si ese correo existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña.";

/** AC36/AC37/AC43: resolver bound to the shared `forgotPasswordSchema`. */
export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await forgotPasswordRequest(values);
      setSent(true);
    } catch {
      setFormError(GENERIC_ERROR);
    }
  }

  if (sent) {
    return (
      <p className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        {SENT_MESSAGE}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthFormError message={formError} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={authLabelClass}>
          Correo electrónico
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
            {translateFieldError(errors.email.message)}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
