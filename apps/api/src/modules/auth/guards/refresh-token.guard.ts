import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { readRefreshCookie } from '../auth.cookies';
import { InvalidRefreshTokenException } from '../../../common/exceptions/invalid-refresh-token.exception';

/** Augmented shape attached to the request once the guard has run. */
export interface RequestWithRefreshToken extends Request {
  rawRefreshToken: string;
}

/**
 * AC17: rejects a `POST /auth/refresh` request with **no** refresh cookie
 * before any database lookup happens, so a missing cookie can't be
 * distinguished from a slow/invalid one by response timing. Everything
 * beyond "is the cookie present" (expiry, rotation, reuse detection) is
 * inherently stateful/DB-backed and is handled by `AuthService.refresh`,
 * not here.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithRefreshToken>();

    const rawToken = readRefreshCookie(request);
    if (!rawToken) {
      // Intentionally the generic InvalidRefreshTokenException (not a bare
      // UnauthorizedException) so AC17's response is indistinguishable
      // from every other refresh-failure mode.
      throw new InvalidRefreshTokenException();
    }

    request.rawRefreshToken = rawToken;
    return true;
  }
}
