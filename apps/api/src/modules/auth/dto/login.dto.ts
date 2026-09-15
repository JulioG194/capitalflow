import { loginSchema, type LoginInput } from '@capitalflow/shared-types';

/**
 * Strict variant of the shared schema (rejects extra/unexpected fields at
 * the HTTP boundary), matching the pattern established by
 * `register.dto.ts`. Not a duplicated rule set — `loginSchema` itself
 * remains the single source of truth (AC43).
 */
export const loginBodySchema = loginSchema.strict();

export type LoginDto = LoginInput;
