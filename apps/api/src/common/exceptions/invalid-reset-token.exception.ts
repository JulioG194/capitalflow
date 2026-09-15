import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * AC23: thrown identically whether a reset token is unknown, expired, or
 * already used — the response never reveals which condition applied.
 */
export class InvalidResetTokenException extends DomainException {
  constructor() {
    super(
      'INVALID_RESET_TOKEN',
      'This password reset link is invalid or has expired.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
