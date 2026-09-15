import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth-token.types';

/** Augmented shape attached to the request once the guard has run. */
export interface RequestWithUser extends Request {
  user: AccessTokenPayload;
}

/**
 * AC26/AC27: verifies the `Authorization: Bearer <token>` access JWT
 * (RS256 signature + expiry, both checked by `JwtService.verifyAsync`
 * using the module's configured public key). Missing, malformed, or
 * expired tokens are all rejected with an identical `401` before any
 * database lookup happens (spec Edge Cases: "malformed JWT ... rejected
 * with 401 before any user lookup occurs") — this guard is intentionally
 * stateless; resolving the actual user record is `AuthService.getProfile`'s
 * job, not this guard's.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      request.user = { sub: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== 'string') {
      return undefined;
    }
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
