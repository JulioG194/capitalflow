import { randomBytes, createHash } from 'node:crypto';

/**
 * Generates a high-entropy (256-bit) opaque token for refresh/reset tokens
 * (spec 002 section 7). This is the raw value handed to the client exactly
 * once — it is never itself persisted, only its hash (see `hashToken`).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash of a raw refresh/reset token, for server-side storage. A
 * database read alone can never be used to forge a valid session or reset
 * link, since only this hash — not the raw value — is ever persisted.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
