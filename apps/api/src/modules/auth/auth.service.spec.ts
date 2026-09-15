import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';

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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock<Promise<UserRecord | null>, [FindUniqueArgs]>;
      create: jest.Mock<Promise<UserRecord>, [CreateArgs]>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn<Promise<UserRecord | null>, [FindUniqueArgs]>(),
        create: jest.fn<Promise<UserRecord>, [CreateArgs]>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
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
});
