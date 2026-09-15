"use client"; // react-hook-form state + submit handler, navigation on success

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { registerSchema, type RegisterInput } from "@capitalflow/shared-types";
import { registerRequest } from "@/lib/auth/auth-client";
import { ApiError } from "@/lib/auth/errors";
import { translateFieldError } from "@/lib/auth/error-messages";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

const GENERIC_REGISTER_ERROR =
  "No pudimos crear tu cuenta. Inténtalo de nuevo en unos minutos.";

/**
 * AC36/AC37/AC43: `react-hook-form` bound to the shared `registerSchema` via
 * `zodResolver` — invalid input (e.g. weak password) is blocked client-side
 * and never reaches the network (AC37).
 */
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await registerRequest(values);
      // AC1: registration issues no tokens — the user must log in separately.
      router.push("/login?registered=1");
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_EXISTS") {
        setFormError("Ya existe una cuenta con este correo electrónico.");
        return;
      }
      setFormError(GENERIC_REGISTER_ERROR);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthFormError message={formError} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={authLabelClass}>
          Nombre
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className={authInputClass}
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" className={authFieldErrorClass}>
            {translateFieldError(errors.name.message)}
          </p>
        )}
      </div>

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={authLabelClass}>
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={authInputClass}
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
          {...register("password")}
        />
        {errors.password ? (
          <p id="password-error" className={authFieldErrorClass}>
            {translateFieldError(errors.password.message)}
          </p>
        ) : (
          <p id="password-hint" className="text-xs text-ink-muted">
            Mínimo 10 caracteres, con al menos una letra y un número.
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}
