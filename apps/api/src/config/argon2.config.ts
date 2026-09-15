import { argon2id, type HashOptions } from 'argon2';

/**
 * Argon2id parameters for password hashing (spec 002, Implementation
 * Notes). Values follow the OWASP-recommended interactive-login baseline
 * (>= 19 MiB memory, time cost 2, parallelism 1) and are centralized here
 * rather than inlined as magic numbers at each `argon2.hash`/`argon2.verify`
 * call site.
 */
export const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456, // ~19 MiB, in KiB
  timeCost: 2,
  parallelism: 1,
};
