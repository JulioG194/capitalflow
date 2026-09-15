import { Test, TestingModule } from '@nestjs/testing';
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
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';

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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock<Promise<UserRecord | null>, [FindUniqueArgs]>;
      create: jest.Mock<Promise<UserRecord>, [CreateArgs]>;
    };
    refreshToken: {
      create: jest.Mock<Promise<{ id: string }>, [RefreshTokenCreateArgs]>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn<Promise<UserRecord | null>, [FindUniqueArgs]>(),
        create: jest.fn<Promise<UserRecord>, [CreateArgs]>(),
      },
      refreshToken: {
        create: jest
          .fn<Promise<{ id: string }>, [RefreshTokenCreateArgs]>()
          .mockResolvedValue({ id: 'refresh-token-1' }),
      },
    };

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
              return undefined;
            }),
          },
        },
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
});
