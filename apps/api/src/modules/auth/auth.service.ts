import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserDto } from '@capitalflow/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ARGON2_OPTIONS, DUMMY_ARGON2_HASH } from '../../config/argon2.config';
import type { EnvConfig } from '../../config/env.schema';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { generateRawToken, hashToken } from './auth.crypto';
import type { AccessTokenPayload } from './auth-token.types';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { User } from './entities';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * AC1/AC2/AC3/AC4: creates a user with an Argon2id password hash. The
   * plaintext password is never persisted or logged. Email is normalized
   * to lowercase before lookup/storage (AC4) and a pre-check plus the
   * database's unique constraint (mapped by `PrismaExceptionFilter`) both
   * guard against duplicate emails (AC2), including the concurrent-request
   * race described in spec section 5.
   */
  async register(input: RegisterDto): Promise<UserDto> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name,
      },
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
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
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
  private async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = generateRawToken();
    const refreshTtlDays = this.config.get('JWT_REFRESH_TTL_DAYS', {
      infer: true,
    });
    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });

    return rawToken;
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
