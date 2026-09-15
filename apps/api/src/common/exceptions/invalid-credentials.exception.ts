import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * AC7/AC8: thrown identically for "correct email, wrong password" and
 * "email does not exist" — the message never indicates which condition
 * applied, so a login response can't be used to enumerate registered
 * emails.
 */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super(
      'INVALID_CREDENTIALS',
      'Incorrect email or password.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
