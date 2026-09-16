import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserDto } from '@capitalflow/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ARGON2_OPTIONS, DUMMY_ARGON2_HASH } from '../../config/argon2.config';
import type { EnvConfig } from '../../config/env.schema';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '../../common/exceptions/invalid-refresh-token.exception';
import { InvalidResetTokenException } from '../../common/exceptions/invalid-reset-token.exception';
import { generateRawToken, hashToken } from './auth.crypto';
import type { AccessTokenPayload } from './auth-token.types';
import { EmailService } from './email/email.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { User } from './entities';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

interface IssuedRefreshToken {
  raw: string;
  id: string;
}

/**
 * AC20/AC21: identical message regardless of whether the email exists — a
 * single constant so the two branches can't accidentally drift.
 */
export const GENERIC_PASSWORD_RESET_MESSAGE =
  'If that email exists, a password reset link has been sent.';

/**
 * Spec 006 AC28: dev-mode-only message, returned instead of
 * `GENERIC_PASSWORD_RESET_MESSAGE` when a real reset link was minted and
 * `NODE_ENV !== "production"` — there is no real email provider, so this is
 * how a local/dev caller recovers the link without reading server logs.
 */
export const DEV_PASSWORD_RESET_MESSAGE = 'Development mode: link not emailed';

export interface ForgotPasswordResult {
  message: string;
  /**
   * Only ever present outside production, and only when `email` matched a
   * real user (a fresh token was actually minted for it) — never fabricated
   * for an unknown email, which would leak account existence through the
   * response body instead of through timing (see AC9's analogous concern
   * for login).
   */
  resetLink?: string;
}

/** Spec 004 AC1: one-time simulated cash grant on registration. */
export const INITIAL_CASH_BALANCE = '10000.00';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * AC1/AC2/AC3/AC4: creates a user with an Argon2id password hash. The
   * plaintext password is never persisted or logged. Email is normalized
   * to lowercase before lookup/storage (AC4) and a pre-check plus the
   * database's unique constraint (mapped by `PrismaExceptionFilter`) both
   * guard against duplicate emails (AC2), including the concurrent-request
   * race described in spec section 5.
   *
   * Spec 004 AC1-3: the `User`, its `Portfolio` (starting `cashBalance`
   * `"10000.00"`), and the matching `deposit` `Transaction` are created in
   * one `$transaction` — if any insert fails, Prisma rolls back all three,
   * so a `User` row can never persist without its `Portfolio`.
   */
  async register(input: RegisterDto): Promise<UserDto> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name,
        },
      });

      const portfolio = await tx.portfolio.create({
        data: {
          userId: createdUser.id,
          cashBalance: INITIAL_CASH_BALANCE,
        },
      });

      await tx.transaction.create({
        data: {
          portfolioId: portfolio.id,
          type: 'deposit',
          amount: INITIAL_CASH_BALANCE,
          status: 'completed',
        },
      });

      return createdUser;
    });

    return this.toUserDto(user);
  }

  /**
   * AC6-11: authenticates a user and issues a fresh access/refresh token
   * pair. Timing-safe against user enumeration (AC9): whether or not
   * `email` matches a user, an Argon2id `verify` call is performed
   * unconditionally — against the real hash if the user exists, or against
   * a fixed dummy hash otherwise — before branching on the result, so both
   * paths do equivalent computational work. Both failure branches throw
   * the identical `InvalidCredentialsException` (AC7/AC8).
   */
  async login(input: LoginDto): Promise<LoginResult> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordMatches = await argon2.verify(
      user?.passwordHash ?? DUMMY_ARGON2_HASH,
      input.password,
    );

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsException();
    }

    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.raw,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * AC12-17: rotates a refresh token, or detects and reacts to reuse.
   *
   * - Unknown token, expired token, or a token already marked revoked
   *   (a "replay" of an already-rotated token, AC14) all fail (AC13/AC17
   *   callers never reach here without a cookie; see `RefreshTokenGuard`).
   * - A revoked-at-read-time token is a proven reuse: **all** of that
   *   user's refresh tokens are revoked before responding (AC14).
   * - The rotation itself is an atomic "mark used and check previous
   *   state" conditional update (`updateMany` with `revokedAt: null` in
   *   its `where`, per spec section 7): if two requests race on the same
   *   token, Postgres serializes the two `UPDATE`s and only the first to
   *   commit sees `count === 1`; the second re-evaluates the predicate
   *   against the now-revoked row and gets `count === 0`. That loser is
   *   treated exactly like a proven reuse — full revocation, including the
   *   spare token it had already created before losing the race (AC16).
   */
  async refresh(rawToken: string): Promise<RefreshResult> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new InvalidRefreshTokenException();
    }

    if (existing.revokedAt) {
      await this.revokeAllRefreshTokensForUser(existing.userId);
      throw new InvalidRefreshTokenException();
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    // Defensive (spec Edge Cases: "refresh token cookie sent but its user
    // was deleted") — not a currently reachable state via any supported
    // operation, but handled the same as any other invalid token.
    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
    });
    if (!user) {
      throw new InvalidRefreshTokenException();
    }

    const newToken = await this.issueRefreshToken(user.id);

    const rotation = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedByTokenId: newToken.id },
    });

    if (rotation.count === 0) {
      await this.revokeAllRefreshTokensForUser(user.id);
      throw new InvalidRefreshTokenException();
    }

    const accessToken = await this.issueAccessToken(user);

    return { accessToken, refreshToken: newToken.raw };
  }

  /**
   * AC18/AC19: revokes the presented refresh token, if any. Idempotent and
   * silent by design — a missing token, an unknown token, and an
   * already-revoked token are all treated identically (simply "nothing
   * left to revoke"), so a caller can never learn from this endpoint's
   * behavior whether a given cookie ever corresponded to a real session.
   */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * AC20/AC21: generates and persists (hashed) a single-use reset token
   * and emails it, but only if the email matches a real user. In
   * production, always returns the identical generic message either way,
   * and `EmailService` is never invoked for a non-existent email (AC21) —
   * there's no timing-safety requirement here (unlike AC9 for login), so no
   * dummy work is performed on the not-found branch.
   *
   * Spec 006 AC27/AC28: `EmailService` (the `ConsoleEmailAdapter`) still
   * logs the link via Nest `Logger` unconditionally — that's the only
   * retrieval path in production. Outside production, this method
   * *additionally* echoes the same link back in the response body so a
   * local caller doesn't have to read logs; that echo only ever happens
   * when `user` was found and a real token was minted above, never
   * fabricated for an unknown email (which would leak account existence
   * through response content instead of response timing).
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let mintedResetLink: string | undefined;

    if (user) {
      const rawToken = generateRawToken();
      const ttlMinutes = this.config.get('PASSWORD_RESET_TTL_MINUTES', {
        infer: true,
      });
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt,
        },
      });

      const webAppOrigin = this.config.get('WEB_APP_ORIGIN', {
        infer: true,
      });
      mintedResetLink = `${webAppOrigin}/reset-password?token=${rawToken}`;
      await this.emailService.sendPasswordResetEmail({
        to: user.email,
        resetLink: mintedResetLink,
      });
    }

    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';

    if (!isProduction && mintedResetLink) {
      return {
        message: DEV_PASSWORD_RESET_MESSAGE,
        resetLink: mintedResetLink,
      };
    }

    return { message: GENERIC_PASSWORD_RESET_MESSAGE };
  }

  /**
   * AC22-25: consumes a reset token to set a new password. An unknown,
   * expired, or already-used token all fail identically (AC23) — checked
   * up front so a doomed request never reaches the transaction below.
   * `newPassword`'s complexity is enforced by the Zod DTO pipe *before*
   * this method is even invoked, so a complexity failure never touches (or
   * consumes) the token (AC24).
   *
   * The actual consumption is an atomic "mark used and check previous
   * state" conditional update, the same CAS pattern used for refresh-token
   * rotation (spec section 7) — guarding against two concurrent requests
   * both trying to consume the same token. It's wrapped together with the
   * password update and the full refresh-token revocation (AC22) in a
   * single DB transaction so all three effects land atomically or not at
   * all.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !existing ||
      existing.usedAt ||
      existing.expiresAt.getTime() < Date.now()
    ) {
      throw new InvalidResetTokenException();
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.prisma.$transaction(async (tx) => {
      const consumption = await tx.passwordResetToken.updateMany({
        where: { id: existing.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (consumption.count === 0) {
        throw new InvalidResetTokenException();
      }

      await tx.user.update({
        where: { id: existing.userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Your password has been reset. Please log in again.' };
  }

  /** AC14/AC16: revokes every currently-active refresh token for a user. */
  private async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** AC10: signs a short-lived RS256 access token carrying `sub`/`email`. */
  private issueAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }

  /**
   * AC11/section 7: generates a high-entropy raw refresh token, persists
   * only its SHA-256 hash, and returns the raw value for the caller to set
   * as an `HttpOnly` cookie. The raw value is never itself stored or
   * returned in a JSON body.
   */
  private async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const rawToken = generateRawToken();
    const refreshTtlDays = this.config.get('JWT_REFRESH_TTL_DAYS', {
      infer: true,
    });
    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });

    return { raw: rawToken, id: record.id };
  }

  /**
   * AC26: `AccessTokenGuard` has already verified the JWT signature/expiry;
   * this resolves the current DB row. Defensive (spec Edge Cases, mirroring
   * the analogous refresh-token case): if the user was deleted after the
   * token was issued, treat it the same as any other invalid session
   * rather than a generic 404.
   */
  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toUserDto(user);
  }

  /**
   * AC28/AC29: only `name` is accepted — enforced upstream by
   * `updateProfileBodySchema`'s `.strict()`, so an attempt to also set
   * `email`/`password` is rejected by the pipe before this method runs,
   * not silently ignored here.
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileDto,
  ): Promise<UserDto> {
    // Defensive (same rationale as `getProfile`): confirm the user still
    // exists before writing, rather than letting a delete-between-guard-
    // and-handler race surface as a raw Prisma "record not found" error.
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });
    return this.toUserDto(user);
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
