# Spec 002: Authentication & User Accounts

**Status**: draft
**Author**: Julio
**Created**: 2026-09-14
**Related specs**: 001-landing-seo (CTAs link here), 006-deployment (future: real email provider adapter)

## 1. Context & Motivation

CapitalFlow needs self-contained account management before any portfolio or market
feature can exist: users must be able to register, log in, stay logged in safely
across sessions, recover a forgotten password, and view/edit their profile. This
spec covers identity and session management only — no investment, portfolio, or
balance logic is part of this feature. Security properties (token rotation, reuse
detection, rate limiting, timing-safe login) are first-class requirements because
this system will be publicly reachable on the internet as a portfolio artifact.

## 2. User Stories

- As a visitor, I want to create an account with my email and a password so I can access the simulator.
- As a returning user, I want to log in and stay logged in for a reasonable period without re-entering my password constantly.
- As a user, I want my session to be automatically protected if a refresh token is stolen and reused by an attacker.
- As a user, I want to reset my password if I forget it, without exposing whether an email address is registered.
- As a user, I want to view and update my basic profile information.
- As a user, I want to log out and know my session is fully terminated.
- As an operator, I want login attempts rate-limited so the endpoint can't be brute-forced.

## 3. Acceptance Criteria

### Registration
- [ ] **AC1**: Given a `POST /auth/register` with a valid unique email, a password meeting the complexity rules, and a name, when the request is processed, then the API creates a user record with an Argon2id password hash (the plaintext password is never persisted or logged) and responds `201` with the created user's `id`, `email`, `name`, and `createdAt` (no password hash, no tokens issued).
- [ ] **AC2**: Given a `POST /auth/register` with an email that already exists (case-insensitive match), when the request is processed, then the API responds `409 Conflict` with a domain error code (e.g. `EMAIL_ALREADY_EXISTS`) and no duplicate record is created.
- [ ] **AC3**: Given a `POST /auth/register` with a password shorter than 10 characters, or missing a letter, or missing a number, when the request is processed, then the API responds `400 Bad Request` with field-level validation errors and no user is created.
- [ ] **AC4**: Given a `POST /auth/register` with an email in mixed case (e.g. `User@Example.com`), when the record is created, then the stored email is normalized to lowercase, and subsequent lookups (login, forgot-password) are case-insensitive on email.
- [ ] **AC5**: Given a `POST /auth/register` with extra/unexpected fields (e.g. `{"role":"admin"}`), when the request is processed, then the global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) rejects the request and no such field is persisted.

### Login
- [ ] **AC6**: Given a `POST /auth/login` with correct email and password, when the request is processed, then the API responds `200` with a short-lived access token (JWT, RS256, 15-minute expiry) in the response body and sets an `HttpOnly` refresh-token cookie (7-day expiry, scoped to the `/auth` path — see the note under AC33 for why this is `/auth` rather than `/auth/refresh`).
- [ ] **AC7**: Given a `POST /auth/login` with a correct email but an incorrect password, when the request is processed, then the API responds `401 Unauthorized` with a generic message that does not indicate the password (specifically) was wrong.
- [ ] **AC8**: Given a `POST /auth/login` with an email that does not exist, when the request is processed, then the API responds with the identical status code and message body as AC7 — indistinguishable from a wrong-password response.
- [ ] **AC9**: Given the non-existent-email path (AC8), when a login attempt is processed, then the service performs a dummy Argon2id hash comparison against a fixed reference hash before responding, so the code path does the same computational work as the existing-user path (mitigates timing-based user enumeration).
- [ ] **AC10**: Given a successful login, when the issued access token is decoded, then it contains at minimum `sub` (user id), `email`, `iat`, and `exp` claims and its signature verifies against the API's RS256 public key.
- [ ] **AC11**: Given a successful login response, when the JSON body is inspected, then the raw refresh token is never present in it (it exists only as the `HttpOnly` cookie value).

### Token Refresh & Reuse Detection
- [ ] **AC12**: Given a valid, unexpired, not-yet-used refresh token cookie, when `POST /auth/refresh` is called, then the API responds `200` with a new access token, marks the presented refresh token as revoked/rotated, issues a new refresh token, and sets it as the new `HttpOnly` cookie.
- [ ] **AC13**: Given an expired refresh token cookie, when `POST /auth/refresh` is called, then the API responds `401 Unauthorized` and clears the refresh cookie.
- [ ] **AC14**: Given a refresh token that was already rotated (used exactly once previously) and is presented again ("replay"), when `POST /auth/refresh` is called, then the API detects the reuse, revokes **all** refresh tokens belonging to that user, responds `401 Unauthorized`, and clears the cookie.
- [ ] **AC15**: Given a user whose tokens were revoked via AC14, when that user's previously issued access token subsequently expires, then no refresh token they hold can produce a new session — they must complete a fresh `POST /auth/login`.
- [ ] **AC16**: Given two near-simultaneous `POST /auth/refresh` requests presenting the same valid refresh token (race condition), when both are processed, then at most one succeeds with a new token pair and the other is treated as a reuse, triggering the full revocation described in AC14.
- [ ] **AC17**: Given a `POST /auth/refresh` request with no refresh cookie present, when the request is processed, then the API responds `401 Unauthorized` without performing a database lookup that could leak timing information about token validity.

### Logout
- [ ] **AC18**: Given an authenticated session with a valid refresh cookie, when `POST /auth/logout` is called, then the API revokes that refresh token, clears the refresh cookie, and responds `200`.
- [ ] **AC19**: Given `POST /auth/logout` is called with no refresh cookie or an already-revoked one, when processed, then the API responds `200` (idempotent) and does not leak whether a session existed.

### Password Reset
- [ ] **AC20**: Given `POST /auth/forgot-password` with an email that exists, when processed, then the API generates a single-use, time-limited reset token, persists only a hashed representation of it, invokes `EmailService` to "send" a reset link containing the raw token, and responds `200` with a generic message (e.g. "If that email exists, a reset link has been sent").
- [ ] **AC21**: Given `POST /auth/forgot-password` with an email that does not exist, when processed, then the API responds `200` with the identical generic message as AC20, and `EmailService` is not invoked.
- [ ] **AC22**: Given a valid, unexpired, unused reset token, when `POST /auth/reset-password` is called with that token and a new password meeting the complexity rules, then the API updates the user's password hash, marks the reset token as used, revokes all existing refresh tokens for that user (forces re-login on every device), and responds `200`.
- [ ] **AC23**: Given an expired or already-used reset token, when `POST /auth/reset-password` is called, then the API responds `400 Bad Request` with a generic "invalid or expired token" message that does not reveal which of the two conditions applied.
- [ ] **AC24**: Given a new password that fails the complexity rules on `POST /auth/reset-password`, when processed, then the API responds `400` with field-level validation errors and the reset token is **not** consumed (it remains usable until it legitimately expires).
- [ ] **AC25**: Given a reset token whose configured expiry window (documented in section 4) has elapsed, when it is presented to `POST /auth/reset-password`, then the request is rejected per AC23.

### Profile
- [ ] **AC26**: Given a valid access token, when `GET /auth/me` is called, then the API responds `200` with the authenticated user's `id`, `email`, `name`, and `createdAt` (no password hash, no tokens).
- [ ] **AC27**: Given a missing, malformed, or expired access token, when `GET /auth/me` is called, then the API responds `401 Unauthorized`.
- [ ] **AC28**: Given a valid access token and a `PATCH /auth/me` body containing a new `name`, when processed, then the API updates the user's name and responds `200` with the updated profile.
- [ ] **AC29**: Given a valid access token and a `PATCH /auth/me` body attempting to set `email` or `password`, when processed, then the API rejects those fields (whitelist validation; only `name` is a permitted field on this endpoint) — email changes and password changes are not handled by this endpoint (password changes happen only via the reset-password flow in this spec).

### Rate Limiting & Security
- [ ] **AC30**: Given 5 `POST /auth/login` requests from the same IP within a rolling 60-second window, when a 6th request is made within that window, then the API responds `429 Too Many Requests` with a `Retry-After` header.
- [ ] **AC31**: Given the rate-limit window has elapsed since the last throttled response, when a subsequent login request is made from the same IP, then the API processes it normally.
- [ ] **AC32**: Given any error response from an `/auth/*` endpoint, when the response body is inspected, then it never contains a raw Prisma error message, stack trace, or SQL detail (all persistence errors are mapped to domain exceptions via an exception filter before reaching the client).
- [ ] **AC33**: Given the refresh-token cookie set by the API, when inspected, then it carries `HttpOnly`, `Secure` (in production), and `SameSite=Strict` or `Lax` attributes, and is scoped to the `/auth` path so it is not transmitted on unrelated (non-auth) requests.

  > **Implementation note (corrected during spec 002 implementation):** this
  > was originally written as `/auth/refresh`. That literal scope is
  > incompatible with AC18 — a cookie whose `Path` is `/auth/refresh` is
  > never sent by the browser on a `POST /auth/logout` request (browsers
  > only attach a cookie to requests at or under its `Path`), so logout
  > could never read the token it's supposed to revoke. `Path=/auth` keeps
  > the actual security intent (never sent to unrelated, non-auth routes
  > like a future `/portfolios/*`) while remaining present on
  > `/auth/login`, `/auth/refresh`, and `/auth/logout`.

### Email Service Abstraction
- [ ] **AC34**: Given the `EmailService` interface, when the forgot-password flow triggers a send, then the concrete adapter used in this spec logs the recipient, subject, and reset link to the server log/console instead of dispatching a real email.
- [ ] **AC35**: Given `EmailService` is injected via NestJS dependency injection (an abstract interface/token, not a concrete class reference), when a future spec (006) supplies a real provider adapter, then no changes are required to `AuthService` or any controller.

### Frontend Pages & Middleware
- [ ] **AC36**: Given an unauthenticated visitor, when they navigate to `/register`, `/login`, `/forgot-password`, or `/reset-password`, then the corresponding form renders using `react-hook-form` with its zod resolver bound to the matching schema imported from `@capitalflow/shared-types`.
- [ ] **AC37**: Given a user submits the login form with invalid input (e.g. empty password), when the form is submitted, then client-side validation displays field errors and no network request is sent to the API.
- [ ] **AC38**: Given a user submits valid login credentials but the API responds `401`, when the response is received, then the UI displays a single generic authentication-failure message (not the raw API error text) and does not indicate whether the email exists.
- [ ] **AC39**: Given an unauthenticated request (no valid refresh-token cookie present) to any route under `/app/*`, when Next.js middleware inspects the request server-side, then it redirects to `/login`, preserving the originally requested path as a `redirect` query parameter.
- [ ] **AC40**: Given an authenticated user, when they navigate to `/app/profile`, then the page displays their current `name` and `email`, and provides a form (using the shared update-profile schema) to edit `name`.
- [ ] **AC41**: Given a successful login, when the frontend handles the response, then the access token is held only in memory (e.g. React context/state) — never written to `localStorage`, `sessionStorage`, or a non-`HttpOnly` cookie.
- [ ] **AC42**: Given an authenticated user clicks "logout" in the UI, when the action completes, then the frontend has called `POST /auth/logout`, cleared the in-memory access token, and navigated to `/login`.

### Shared Validation Schemas
- [ ] **AC43**: Given `packages/shared-types`, when its auth module is inspected, then `registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, and `updateProfileSchema` are each defined exactly once and are the schemas imported by both `apps/api` (request DTO validation) and `apps/web` (form resolvers) — no parallel/duplicate schema is defined in either app.
- [ ] **AC44**: Given the password-complexity rule (min 10 characters, at least one letter, at least one number), when it is applied in `registerSchema` and `resetPasswordSchema`, then both reference the same shared zod refinement (a single source of truth), not two independently written rules.

## 4. Technical Contracts

### API endpoints (`apps/api`, `src/modules/auth/`)

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | /auth/register | none | `{ email: string; password: string; name: string }` | `201 { id: string; email: string; name: string; createdAt: string }` |
| POST | /auth/login | none, rate-limited (5/min/IP) | `{ email: string; password: string }` | `200 { accessToken: string; user: { id; email; name } }` + sets refresh cookie |
| POST | /auth/refresh | refresh cookie | *(no body)* | `200 { accessToken: string }` + rotates refresh cookie |
| POST | /auth/logout | refresh cookie | *(no body)* | `200 {}` + clears refresh cookie |
| GET | /auth/me | Bearer access token | — | `200 { id: string; email: string; name: string; createdAt: string }` |
| PATCH | /auth/me | Bearer access token | `{ name: string }` | `200 { id: string; email: string; name: string; createdAt: string }` |
| POST | /auth/forgot-password | none | `{ email: string }` | `200 { message: string }` (generic, always the same shape) |
| POST | /auth/reset-password | none | `{ token: string; newPassword: string }` | `200 { message: string }` |

Access tokens are returned in the JSON response body and expected to be sent by the
client as `Authorization: Bearer <token>` on subsequent requests. Refresh tokens are
never present in a JSON body; they exist only as the `HttpOnly` cookie set on
`/auth/login` and `/auth/refresh`, and cleared on `/auth/logout`.

### Shared types (`packages/shared-types/src/auth.ts`)

```ts
import { z } from "zod";

// Single source of truth for password complexity (AC44)
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: Pick<UserDto, "id" | "email" | "name">;
}
```

### Database changes

New Prisma models (exact schema/migration written at implementation time; this is
the requirement-level shape). Suggested migration name: `add_users_and_auth_tokens`.

- **User**: `id` (uuid, PK), `email` (unique, stored lowercase), `passwordHash`
  (Argon2id output), `name`, `createdAt`, `updatedAt`.
- **RefreshToken**: `id` (uuid, PK), `userId` (FK → User), `tokenHash` (hash of the
  raw token — the raw value is never persisted), `expiresAt`, `revokedAt`
  (nullable), `replacedByTokenId` (nullable, self-reference for rotation
  auditing), `createdAt`. Used to implement rotation (AC12) and reuse detection
  (AC14, AC16).
- **PasswordResetToken**: `id` (uuid, PK), `userId` (FK → User), `tokenHash`
  (hash of the raw token), `expiresAt`, `usedAt` (nullable), `createdAt`.

Raw refresh tokens and raw reset tokens are never stored — only a hash (e.g.
SHA-256) of the value handed to the client, so a database read alone cannot be
used to forge a valid session or reset link.

### Frontend routes / components (`apps/web/src/app`)

- `(marketing)/register/page.tsx` → `/register`
- `(marketing)/login/page.tsx` → `/login`
- `(marketing)/forgot-password/page.tsx` → `/forgot-password`
- `(marketing)/reset-password/page.tsx` → `/reset-password` (reads `?token=` query param)
- `(app)/profile/page.tsx` → `/app/profile` (protected)
- `middleware.ts` — inspects the refresh-token cookie server-side for every
  `/app/*` request; redirects to `/login?redirect=<original path>` if absent/invalid
- `<AuthForm>` variants (`RegisterForm`, `LoginForm`, `ForgotPasswordForm`,
  `ResetPasswordForm`) — `"use client"` (uses `react-hook-form` state and submit
  handlers)
- `<AuthProvider>` — `"use client"` (holds the in-memory access token in React
  context and exposes login/logout/refresh helpers to the app)
- `<ProfileForm>` — `"use client"` (controlled form with local edit state)

### Backend module structure (`apps/api/src/modules/auth/`)

- `auth.controller.ts` — the eight endpoints above
- `auth.service.ts` — registration, login, token issuance/rotation, reuse
  detection, password reset orchestration
- `dto/` — `RegisterDto`, `LoginDto`, `ForgotPasswordDto`, `ResetPasswordDto`,
  `UpdateProfileDto` (built from the shared zod schemas)
- `entities/` — `User`, `RefreshToken`, `PasswordResetToken` (Prisma-generated types)
- `email/email.service.ts` — `EmailService` interface + `ConsoleEmailAdapter`
  (this spec's only concrete implementation)
- `guards/` — `AccessTokenGuard` (verifies Bearer JWT), `RefreshTokenGuard`
  (validates refresh cookie)
- Config: JWT RS256 key pair, access/refresh TTLs, reset-token TTL, and rate-limit
  thresholds are loaded via `@nestjs/config` with Zod schema validation; the app
  fails to start if required env vars are missing.

## 5. Edge Cases & Errors

- **Concurrent registration with the same email**: a unique constraint race at the
  database level is caught and mapped to the same `409 EMAIL_ALREADY_EXISTS`
  response as AC2 — never a raw Prisma unique-constraint error.
- **Access token expires mid-session**: any protected request with an expired
  access token returns `401`; the frontend `<AuthProvider>` transparently calls
  `POST /auth/refresh` once and retries the original request before surfacing an
  error to the user.
- **Refresh token cookie sent but its user was deleted** (not currently a
  supported operation, but defensive): `POST /auth/refresh` responds `401` as if
  the token were invalid.
- **Malformed JWT (tampered signature)** on any protected endpoint: rejected with
  `401` before any user lookup occurs.
- **Reset-password token guessed/brute-forced**: tokens are high-entropy
  (cryptographically random, ≥256 bits before hashing) so brute-forcing within the
  expiry window is infeasible; repeated invalid attempts against
  `/auth/reset-password` are still subject to a general API rate-limit at the
  infrastructure level (see Implementation Notes).
- **Password reset requested multiple times for the same email**: each request
  issues a new reset token; earlier unused tokens for that user remain valid
  until their own expiry (not automatically invalidated) — the first token that
  gets successfully consumed wins, per AC22.
- **Rate limit is per-IP, not per-email**: a distributed attacker spreading login
  attempts across many IPs against one email account is not mitigated by AC30
  alone (documented, not solved by this spec — see Out of Scope).
- **Clock skew** between API instances (if horizontally scaled) could cause a
  token to appear expired/valid inconsistently; out of scope to solve here but
  flagged for infra design.
- **Cookie behind Nginx reverse proxy**: `Secure` cookies require the proxy to
  terminate TLS and forward `X-Forwarded-Proto`; the API must trust the proxy
  header in production config.
- **`PATCH /auth/me` with an empty body**: rejected with `400` (no fields to
  update), not a silent no-op `200`.

## 6. Out of Scope

- A real email provider adapter (SendGrid, Postmark, SES, etc.) — this spec ships
  only the `EmailService` interface and a console-logger stub; the real adapter is
  deferred to spec 006 (deployment).
- Email verification / account confirmation on registration (accounts are usable
  immediately after registration in this spec).
- Changing the account email address (only `name` is editable via `PATCH /auth/me`).
- Password change while logged in via a dedicated "change password" endpoint
  (password changes happen only through the forgot/reset-password flow in this
  spec).
- OAuth / social login (Google, GitHub, etc.).
- Two-factor authentication (2FA/MFA).
- Account deletion, data export, or GDPR-style self-service tooling.
- Admin roles, permissions, or RBAC of any kind.
- A session-management UI (e.g. "log out of all other devices" / listing active
  sessions individually) — the only bulk revocation path is the automatic one
  triggered by reuse detection (AC14) or password reset (AC22).
- CAPTCHA or bot-detection beyond the fixed per-IP rate limit on `/auth/login`.
- Distributed/per-account rate limiting across many source IPs (see Edge Cases).
- Any financial, portfolio, transaction, or "Modo Simulador" balance logic — this
  spec is identity and session management only.
- Internationalization of auth pages beyond the project's default `es` locale
  (per spec 001).

## 7. Implementation Notes

- Password hashing: `argon2` npm package, `argon2id` variant, tuned parameters
  (memory/time cost) documented in the module's config, not hardcoded magic
  numbers.
- JWT: `@nestjs/jwt` configured with an RS256 key pair; private key signs, public
  key verifies (enables future services to verify tokens without holding the
  signing secret).
- Refresh/reset tokens: generate with `crypto.randomBytes`, store only a SHA-256
  hash server-side; the raw value is handed to the client exactly once (cookie
  for refresh tokens, reset link for reset tokens).
- Rate limiting: `@nestjs/throttler` (or equivalent) scoped specifically to
  `POST /auth/login`.
- Timing-safe login (AC9): perform the Argon2id verify call unconditionally
  (against a fixed dummy hash when the user doesn't exist) before branching on
  the result, so both code paths do equivalent work.
- Reuse detection requires an atomic "mark used and check previous state" update
  (e.g. a single conditional DB update) to correctly resolve the race in AC16.

## 8. Validation Plan

### Automated
- **Unit tests (Jest, `apps/api`)**: Argon2id hashing/verification, JWT
  issuance/verification, refresh-token rotation logic, reuse-detection state
  machine, password/reset-token complexity and expiry checks, timing-safe login
  branch coverage.
- **Integration tests (Jest + test DB, `apps/api`)**: every endpoint in section 4
  for both success and documented error paths (401/400/409/429); rate-limit
  behavior on `/auth/login`; cookie attributes (`HttpOnly`, `Secure`, `SameSite`,
  `Path`) on login/refresh/logout responses; reuse-detection full-revocation
  effect verified by attempting a second refresh after the triggering replay.
- **Unit tests (Vitest, `apps/web`)**: shared zod schemas (valid/invalid cases per
  rule), `<AuthProvider>` in-memory token behavior.
- **E2E (Playwright)**: register → login → view `/app/profile` → edit name →
  logout; unauthenticated visit to `/app/profile` redirects to `/login`; forgot
  password → capture the logged reset link from the console adapter → reset
  password → old refresh session is invalidated → new login succeeds.

### Manual
- Confirm the refresh cookie is not readable from browser DevTools console via
  `document.cookie` (HttpOnly enforcement).
- Manually replay a used refresh token (e.g. via `curl` with a captured cookie
  value) and confirm all sessions for that user are revoked.
- Verify `/auth/*` error responses in a failed-DB-connection scenario never leak
  a Prisma stack trace (staging environment check).
- Load-test `/auth/login` briefly to confirm the 429 response and `Retry-After`
  header behave as expected under the configured threshold.
