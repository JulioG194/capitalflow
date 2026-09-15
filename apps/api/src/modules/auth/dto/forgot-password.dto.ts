import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@capitalflow/shared-types';

/**
 * Strict variant of the shared schema, matching the pattern established by
 * `register.dto.ts`/`login.dto.ts`.
 */
export const forgotPasswordBodySchema = forgotPasswordSchema.strict();

export type ForgotPasswordDto = ForgotPasswordInput;
