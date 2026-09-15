import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// `argon2`'s named exports come from a native addon and are non-configurable,
// so `jest.spyOn(argon2, 'verify')` fails with "Cannot redefine property".
// Replacing the whole module with a jest.fn() wrapper around the real
// implementation keeps behavior identical while making calls assertable
// (needed for AC9's "verify was actually invoked" check below).
jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, verify: jest.fn(actual.verify) };
});
import { AuthService, INITIAL_CASH_BALANCE } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email/email.service';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '../../common/exceptions/invalid-refresh-token.exception';
import { InvalidResetTokenException } from '../../common/exceptions/invalid-reset-token.exception';
import { hashToken } from './auth.crypto';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FindUniqueArgs {
  where: { email: string };
}

interface CreateArgs {
  data: { email: string; passwordHash: string; name: string };
}

interface RefreshTokenCreateArgs {
  data: { userId: string; tokenHash: string; expiresAt: Date };
}

interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

interface RefreshTokenFindUniqueArgs {
  where: { tokenHash: string };
}

interface RefreshTokenUpdateManyArgs {
  where: { id?: string; userId?: string; revokedAt: null };
  data: { revokedAt: Date; replacedByTokenId?: string };
}

interface UserFindUniqueByIdArgs {
  where: { id: string };
}

interface UserUpdateArgs {
  where: { id: string };
  data: { passwordHash: string };
}

interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface PasswordResetTokenCreateArgs {
  data: { userId: string; tokenHash: string; expiresAt: Date };
}

interface PasswordResetTokenFindUniqueArgs {
  where: { tokenHash: string };
}

interface PasswordResetTokenUpdateManyArgs {
  where: { id: string; usedAt: null };
  data: { usedAt: Date };
}

interface PortfolioRecord {
  id: string;
  userId: string;
  cashBalance: string;
  createdAt: Date;
}

interface PortfolioCreateArgs {
  data: { userId: string; cashBalance: string };
}

interface TransactionRecord {
  id: string;
  portfolioId: string;
  type: string;
  symbol: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  status: string;
  createdAt: Date;
}

interface TransactionCreateArgs {
  data: { portfolioId: string; type: string; amount: string; status: string };
}

interface PrismaMock {
  user: {
    findUnique: jest.Mock<
      Promise<UserRecord | null>,
      [FindUniqueArgs | UserFindUniqueByIdArgs]
    >;
    create: jest.Mock<Promise<UserRecord>, [CreateArgs]>;
    update: jest.Mock<Promise<UserRecord>, [UserUpdateArgs]>;
  };
  refreshToken: {
    create: jest.Mock<Promise<{ id: string }>, [RefreshTokenCreateArgs]>;
    findUnique: jest.Mock<
      Promise<RefreshTokenRecord | null>,
      [RefreshTokenFindUniqueArgs]
    >;
    updateMany: jest.Mock<
      Promise<{ count: number }>,
      [RefreshTokenUpdateManyArgs]
    >;
  };
  passwordResetToken: {
    create: jest.Mock<Promise<{ id: string }>, [PasswordResetTokenCreateArgs]>;
    findUnique: jest.Mock<
      Promise<PasswordResetTokenRecord | null>,
      [PasswordResetTokenFindUniqueArgs]
    >;
    updateMany: jest.Mock<
      Promise<{ count: number }>,
      [PasswordResetTokenUpdateManyArgs]
    >;
  };
  portfolio: {
    create: jest.Mock<Promise<PortfolioRecord>, [PortfolioCreateArgs]>;
  };
  transaction: {
    create: jest.Mock<Promise<TransactionRecord>, [TransactionCreateArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => unknown]>;
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let sendPasswordResetEmail: jest.Mock<
    Promise<void>,
    [{ to: string; resetLink: string }]
  >;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn<
          Promise<UserRecord | null>,
          [FindUniqueArgs | UserFindUniqueByIdArgs]
        >(),
        create: jest.fn<Promise<UserRecord>, [CreateArgs]>(),
        update: jest.fn<Promise<UserRecord>, [UserUpdateArgs]>(),
      },
      refreshToken: {
        create: jest
          .fn<Promise<{ id: string }>, [RefreshTokenCreateArgs]>()
          .mockResolvedValue({ id: 'refresh-token-1' }),
        findUnique: jest.fn<
          Promise<RefreshTokenRecord | null>,
          [RefreshTokenFindUniqueArgs]
        >(),
        updateMany: jest
          .fn<Promise<{ count: number }>, [RefreshTokenUpdateManyArgs]>()
          .mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: {
        create: jest
          .fn<Promise<{ id: string }>, [PasswordResetTokenCreateArgs]>()
          .mockResolvedValue({ id: 'reset-token-1' }),
        findUnique: jest.fn<
          Promise<PasswordResetTokenRecord | null>,
          [PasswordResetTokenFindUniqueArgs]
        >(),
        updateMany: jest
          .fn<Promise<{ count: number }>, [PasswordResetTokenUpdateManyArgs]>()
          .mockResolvedValue({ count: 1 }),
      },
      portfolio: {
        create: jest
          .fn<Promise<PortfolioRecord>, [PortfolioCreateArgs]>()
          .mockImplementation(({ data }: PortfolioCreateArgs) =>
            Promise.resolve({
              id: 'portfolio-1',
              userId: data.userId,
              cashBalance: data.cashBalance,
              createdAt: new Date(),
            }),
          ),
      },
      transaction: {
        create: jest
          .fn<Promise<TransactionRecord>, [TransactionCreateArgs]>()
          .mockImplementation(({ data }: TransactionCreateArgs) =>
            Promise.resolve({
              id: 'transaction-1',
              portfolioId: data.portfolioId,
              type: data.type,
              symbol: null,
              quantity: null,
              price: null,
              amount: data.amount,
              status: data.status,
              createdAt: new Date(),
            }),
          ),
      },
      // Interactive transactions here just run the callback against the
      // same mock client — real cross-statement atomicity is verified at
      // the e2e level (Postgres), not re-derived from mocks.
      $transaction: jest.fn((callback: (tx: PrismaMock) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    };

    sendPasswordResetEmail = jest
      .fn<Promise<void>, [{ to: string; resetLink: string }]>()
      .mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_REFRESH_TTL_DAYS') return 7;
              if (key === 'PASSWORD_RESET_TTL_MINUTES') return 30;
              if (key === 'WEB_APP_ORIGIN') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
        { provide: EmailService, useValue: { sendPasswordResetEmail } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    const input = {
      email: 'User@Example.com',
      password: 'correcthorse1',
      name: 'Ada Lovelace',
    };

    it('AC1: creates a user with an Argon2id hash and returns a sanitized DTO', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({
          id: 'user-1',
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          createdAt,
          updatedAt: createdAt,
        }),
      );

      const result = await service.register(input);

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Ada Lovelace',
        createdAt: createdAt.toISOString(),
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('accessToken');

      const [createCall] = prisma.user.create.mock.calls[0];
      expect(createCall.data.passwordHash).not.toBe(input.password);
      const hashMatches = await argon2.verify(
        createCall.data.passwordHash,
        input.password,
      );
      expect(hashMatches).toBe(true);
    });

    it('AC2: throws EmailAlreadyExistsException when the email is already taken and does not create a row', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'user@example.com',
        passwordHash: 'hash',
        name: 'Existing User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.register(input)).rejects.toBeInstanceOf(
        EmailAlreadyExistsException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('AC4: normalizes mixed-case email to lowercase for lookup and storage', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({
          id: 'user-2',
          email: data.email,
          passwordHash: 'hash',
          name: data.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await service.register(input);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      const [createCall] = prisma.user.create.mock.calls[0];
      expect(createCall.data.email).toBe('user@example.com');
      expect(result.email).toBe('user@example.com');
    });

    it('spec 004 AC1: creates a Portfolio with the $10,000 starting cash balance in the same transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({
          id: 'user-3',
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      await service.register(input);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.portfolio.create).toHaveBeenCalledWith({
        data: { userId: 'user-3', cashBalance: INITIAL_CASH_BALANCE },
      });
    });

    it('spec 004 AC2: creates exactly one completed deposit Transaction for the new Portfolio', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({
          id: 'user-4',
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      await service.register(input);

      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          portfolioId: 'portfolio-1',
          type: 'deposit',
          amount: INITIAL_CASH_BALANCE,
          status: 'completed',
        },
      });
    });

    it('spec 004 AC3: rolls back and never creates the User when Portfolio creation fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({
          id: 'user-5',
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      prisma.portfolio.create.mockRejectedValue(new Error('db unavailable'));

      await expect(service.register(input)).rejects.toThrow('db unavailable');
      // Real cross-statement rollback is Postgres's job (verified at the e2e
      // level); here we only assert the transaction callback's own error
      // propagates rather than being swallowed, and that the dependent
      // deposit Transaction is never attempted once Portfolio creation fails.
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const password = 'correcthorse1';
    let userRecord: UserRecord;

    beforeEach(async () => {
      userRecord = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
        name: 'Ada Lovelace',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
    });

    it('AC6/AC10/AC11: returns an access token, a raw refresh token, and a sanitized user on success', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord);

      const result = await service.login({
        email: 'User@Example.com',
        password,
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Ada Lovelace',
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const [createCall] = prisma.refreshToken.create.mock.calls[0];
      expect(createCall.data.userId).toBe('user-1');
      // The raw token itself must never be persisted, only its hash.
      expect(createCall.data.tokenHash).not.toBe(result.refreshToken);
    });

    it('AC7: throws the generic InvalidCredentialsException on a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord);

      await expect(
        service.login({
          email: userRecord.email,
          password: 'wrong-password-1',
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('AC8: throws the identical InvalidCredentialsException for a non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('AC9: performs an Argon2id verify even when the user does not exist (timing-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const verifyMock = jest.mocked(argon2.verify);
      verifyMock.mockClear();

      await expect(
        service.login({ email: 'nobody@example.com', password }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      expect(verifyMock).toHaveBeenCalledTimes(1);
      const [hashArg] = verifyMock.mock.calls[0];
      expect(hashArg).not.toBe(userRecord.passwordHash);
    });
  });

  describe('refresh', () => {
    const userRecord: UserRecord = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'irrelevant-hash',
      name: 'Ada Lovelace',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    function activeRefreshToken(
      overrides: Partial<RefreshTokenRecord> = {},
    ): RefreshTokenRecord {
      return {
        id: 'refresh-token-old',
        userId: userRecord.id,
        tokenHash: 'irrelevant-hash-value',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    beforeEach(() => {
      prisma.user.findUnique.mockImplementation((args) => {
        if ('id' in args.where) {
          return Promise.resolve(
            args.where.id === userRecord.id ? userRecord : null,
          );
        }
        return Promise.resolve(null);
      });
    });

    it('AC12: rotates a valid token — revokes the old one and returns a fresh pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeRefreshToken());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refresh('raw-token');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'refresh-token-old', revokedAt: null },
        data: expect.objectContaining({
          replacedByTokenId: 'refresh-token-1',
        }) as unknown,
      });
    });

    it('AC13: throws on an expired token without a full revocation', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it("AC14: replaying an already-rotated token revokes all of that user's tokens", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeRefreshToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: userRecord.id, revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date) as unknown,
        }) as unknown,
      });
    });

    it('AC16: loses the rotation race (count 0) and triggers full revocation instead of returning a token pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeRefreshToken());
      // First call is the CAS rotation attempt (loses the race); second call
      // (from `revokeAllRefreshTokensForUser`) is the full-revocation sweep.
      prisma.refreshToken.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 2 });

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenNthCalledWith(2, {
        where: { userId: userRecord.id, revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date) as unknown,
        }) as unknown,
      });
    });

    it('unknown token hash throws without touching updateMany', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('AC18: revokes the presented token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken('raw-token'), revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date) as unknown,
        }) as unknown,
      });
    });

    it('AC19: is a no-op (no DB call) when no token is presented', async () => {
      await service.logout(undefined);

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('AC19: resolves without throwing when the token is already revoked/unknown', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('raw-token')).resolves.toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    const userRecord: UserRecord = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'irrelevant-hash',
      name: 'Ada Lovelace',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('AC20: persists a hashed reset token and emails the reset link when the user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord);

      const result = await service.forgotPassword('User@Example.com');

      expect(result).toEqual({
        message: 'If that email exists, a password reset link has been sent.',
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const [createCall] = prisma.passwordResetToken.create.mock.calls[0];
      expect(createCall.data.userId).toBe(userRecord.id);
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [emailCall] = sendPasswordResetEmail.mock.calls[0];
      expect(emailCall.to).toBe(userRecord.email);
      expect(emailCall.resetLink).toMatch(
        /^http:\/\/localhost:3000\/reset-password\?token=/,
      );
      // The raw token in the email link must not equal the persisted hash.
      const rawTokenFromLink = emailCall.resetLink.split('token=')[1];
      expect(createCall.data.tokenHash).not.toBe(rawTokenFromLink);
    });

    it('AC21: returns the identical generic message and never calls EmailService for a non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@example.com');

      expect(result).toEqual({
        message: 'If that email exists, a password reset link has been sent.',
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    function activeResetToken(
      overrides: Partial<PasswordResetTokenRecord> = {},
    ): PasswordResetTokenRecord {
      return {
        id: 'reset-token-old',
        userId: 'user-1',
        tokenHash: 'irrelevant-hash-value',
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        usedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('AC22: consumes the token, updates the password, and revokes all refresh tokens for the user', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        activeResetToken(),
      );
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword(
        'raw-reset-token',
        'newcorrecthorse1',
      );

      expect(result).toEqual({
        message: 'Your password has been reset. Please log in again.',
      });
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'reset-token-old', usedAt: null },
        data: expect.objectContaining({
          usedAt: expect.any(Date) as unknown,
        }) as unknown,
      });
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const [updateCall] = prisma.user.update.mock.calls[0];
      expect(updateCall.where.id).toBe('user-1');
      expect(updateCall.data.passwordHash).not.toBe('newcorrecthorse1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date) as unknown,
        }) as unknown,
      });
    });

    it('AC23: rejects an unknown token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('raw-reset-token', 'newcorrecthorse1'),
      ).rejects.toBeInstanceOf(InvalidResetTokenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('AC23/AC25: rejects an expired token without consuming it further', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        activeResetToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.resetPassword('raw-reset-token', 'newcorrecthorse1'),
      ).rejects.toBeInstanceOf(InvalidResetTokenException);
      expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('AC23: rejects an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        activeResetToken({ usedAt: new Date() }),
      );

      await expect(
        service.resetPassword('raw-reset-token', 'newcorrecthorse1'),
      ).rejects.toBeInstanceOf(InvalidResetTokenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('loses the consume-token race (count 0) and rejects without updating the password', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        activeResetToken(),
      );
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword('raw-reset-token', 'newcorrecthorse1'),
      ).rejects.toBeInstanceOf(InvalidResetTokenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('AC26: returns the sanitized profile for an existing user', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'irrelevant-hash',
        name: 'Ada Lovelace',
        createdAt,
        updatedAt: createdAt,
      });

      const result = await service.getProfile('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Ada Lovelace',
        createdAt: createdAt.toISOString(),
      });
    });

    it('throws Unauthorized when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('AC28: updates the name and returns the sanitized profile', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'irrelevant-hash',
        name: 'Old Name',
        createdAt,
        updatedAt: createdAt,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'irrelevant-hash',
        name: 'New Name',
        createdAt,
        updatedAt: createdAt,
      });

      const result = await service.updateProfile('user-1', {
        name: 'New Name',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
    });

    it('throws Unauthorized when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('user-1', { name: 'New Name' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
