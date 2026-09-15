/**
 * Claims carried by the RS256 access token (spec 002 AC10). Signed by
 * `AuthService` (login/refresh), verified by `AccessTokenGuard` — kept in
 * one place so both sides agree on the shape.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}
