"use client"; // consumes useAuth() context and holds local edit/success state

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileSchema, type UpdateProfileInput } from "@capitalflow/shared-types";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateMe } from "@/lib/auth/auth-client";
import { AuthFormError } from "@/components/auth/AuthFormError";
import {
  authFieldErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "@/components/auth/form-styles";

const GENERIC_UPDATE_ERROR = "We couldn't update your profile. Please try again.";

/**
 * AC40: displays the authenticated user's current name/email and lets them
 * edit `name` — the only field `updateProfileSchema`/`PATCH /auth/me`
 * permits (AC29 rejects `email`/`password` on this endpoint).
 */
export function ProfileForm() {
  const { user, isLoading, refreshUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    // `values` (not `defaultValues`) keeps the field in sync once `user`
    // finishes loading asynchronously after the initial (null) render.
    values: user ? { name: user.name } : undefined,
  });

  async function onSubmit(values: UpdateProfileInput) {
    setFormError(null);
    setSaved(false);
    try {
      await updateMe(values);
      await refreshUser();
      setSaved(true);
    } catch {
      setFormError(GENERIC_UPDATE_ERROR);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Loading profile...</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-ink-muted">
        We couldn&apos;t load your profile. Try logging in again.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthFormError message={formError} />
      {saved && !formError && (
        <p className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Profile updated.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={authLabelClass}>Email</span>
        <p className="rounded-card border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-ink-muted">
          {user.email}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={authLabelClass}>
          Name
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
            {errors.name.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
