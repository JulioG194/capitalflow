import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@capitalflow/shared-types';

/**
 * Strict variant of the shared schema, matching the pattern established by
 * `register.dto.ts`/`login.dto.ts`. `newPassword`'s complexity rule is
 * validated here (via the shared `passwordSchema` refinement, AC44) before
 * the controller/service ever runs — so a complexity failure never touches
 * the reset token (AC24).
 */
export const resetPasswordBodySchema = resetPasswordSchema.strict();

export type ResetPasswordDto = ResetPasswordInput;
