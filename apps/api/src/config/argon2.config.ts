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

/**
 * Fixed reference hash used for timing-safe login (spec 002 AC9). The
 * `argon2` package exposes no synchronous hash function, so this can't be
 * computed inline at request time (or even once at module init without an
 * async IIFE dance) — it's the precomputed output of
 * `argon2.hash('dummy-password-for-timing-safety-ac9', ARGON2_OPTIONS)`,
 * generated once offline and pasted in here. When a login is attempted
 * against an email that doesn't exist, `AuthService.login` runs
 * `argon2.verify` against *this* hash (ignoring the result) before
 * responding, so the non-existent-user code path costs the same CPU time
 * as the real-user path and can't be used to enumerate registered emails
 * via response-time measurement.
 */
export const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$qPic/y+f9M6+qHbBGTVsLw$p67usVST4KyvD6j+JZGW24VXW4Ut5wfCmbiUH97Aa6s';
