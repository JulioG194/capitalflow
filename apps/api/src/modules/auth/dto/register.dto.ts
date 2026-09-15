import { registerSchema, type RegisterInput } from '@capitalflow/shared-types';

/**
 * Strict variant of the shared schema used at the HTTP boundary: rejects
 * unexpected/extra fields (AC5) instead of silently stripping them. This is
 * a transform of the single shared schema, not a duplicated rule set
 * (AC43/AC44 — `registerSchema` itself is untouched and still the source
 * of truth used elsewhere, e.g. `apps/web` form resolvers).
 */
export const registerBodySchema = registerSchema.strict();

export type RegisterDto = RegisterInput;
