import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { UserDto } from '@capitalflow/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ARGON2_OPTIONS } from '../../config/argon2.config';
import { EmailAlreadyExistsException } from '../../common/exceptions/email-already-exists.exception';
import type { RegisterDto } from './dto/register.dto';
import type { User } from './entities';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
