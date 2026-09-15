/**
 * Translates the specific English messages produced by the shared zod
 * schemas in `@capitalflow/shared-types` into Spanish for display in the
 * auth forms (project convention: `es` locale, spec 001). Deliberately
 * scoped to only the exact strings those schemas are known to produce
 * today — the shared schemas themselves are NOT modified (AC43/AC44:
 * single source of truth for validation rules lives in `shared-types`,
 * shared with `apps/api`). Any message not in this table is returned
 * unchanged, so an unmapped/future validation message degrades to English
 * rather than disappearing.
 */
const KNOWN_FIELD_ERROR_MESSAGES: Record<string, string> = {
  // passwordSchema (registerSchema.password, resetPasswordSchema.newPassword)
  "Password must be at least 10 characters":
    "La contraseña debe tener al menos 10 caracteres.",
  "Password must include a letter": "La contraseña debe incluir al menos una letra.",
  "Password must include a number": "La contraseña debe incluir al menos un número.",
  // z.string().email() — registerSchema, loginSchema, forgotPasswordSchema
  "Invalid email address": "Correo electrónico inválido.",
  // z.string().min(1) — registerSchema.name, loginSchema.password,
  // resetPasswordSchema.token, updateProfileSchema.name
  "Too small: expected string to have >=1 characters": "Este campo es obligatorio.",
  // z.string().max(100) — registerSchema.name, updateProfileSchema.name
  "Too big: expected string to have <=100 characters":
    "Este campo es demasiado largo (máximo 100 caracteres).",
};

export function translateFieldError(message: string | undefined): string | undefined {
  if (!message) {
    return message;
  }
  return KNOWN_FIELD_ERROR_MESSAGES[message] ?? message;
}
