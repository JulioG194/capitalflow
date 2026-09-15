/**
 * Shared Tailwind class strings for auth form fields, so `RegisterForm`,
 * `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`, and `ProfileForm`
 * (spec 002) all look consistent without duplicating (and risking drift on)
 * the same class list five times. Plain constants, not a component — no
 * `"use client"` needed here.
 */
export const authInputClass =
  "w-full rounded-card border border-gray-300 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";

export const authLabelClass = "text-sm font-medium text-ink";

export const authFieldErrorClass = "text-sm text-red-600";

export const authSubmitButtonClass =
  "mt-2 inline-flex items-center justify-center rounded-card bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60";
