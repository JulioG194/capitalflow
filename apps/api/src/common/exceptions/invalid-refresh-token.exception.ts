import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * AC13/AC14/AC17: thrown for every refresh-token failure mode (missing,
 * unknown, expired, or reused/already-rotated) with an identical generic
 * message — the client can't distinguish "expired" from "this looks like a
 * replay attack" from the response alone.
 */
export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super(
      'INVALID_REFRESH_TOKEN',
      'Your session has expired. Please log in again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
