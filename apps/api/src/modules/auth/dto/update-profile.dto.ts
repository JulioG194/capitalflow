import {
  updateProfileSchema,
  type UpdateProfileInput,
} from '@capitalflow/shared-types';

/**
 * Strict variant of the shared schema, matching the pattern established by
 * `register.dto.ts`. `name` is required by `updateProfileSchema`, so an
 * empty `{}` body is rejected with `400` by this same pipe (spec Edge
 * Cases: "PATCH /auth/me with an empty body" — AC29) with no extra
 * handling needed.
 */
export const updateProfileBodySchema = updateProfileSchema.strict();

export type UpdateProfileDto = UpdateProfileInput;
