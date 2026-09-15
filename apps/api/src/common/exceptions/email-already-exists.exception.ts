import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/** AC2: registering with an email that already exists (case-insensitive). */
export class EmailAlreadyExistsException extends DomainException {
  constructor() {
    super(
      'EMAIL_ALREADY_EXISTS',
      'An account with this email already exists.',
      HttpStatus.CONFLICT,
    );
  }
}
