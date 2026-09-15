import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

/**
 * Handshake-only RS256 verification (spec 003 AC18–AC20). Missing,
 * malformed, expired, and tampered tokens all take the same reject path —
 * the caller must not surface a distinguishing error to the client.
 */
@Injectable()
export class SocketAuthService {
  private readonly logger = new Logger(SocketAuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  verifyHandshakeToken(token: unknown): AccessTokenPayload | null {
    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        publicKey: this.config.get('JWT_ACCESS_PUBLIC_KEY', { infer: true }),
        algorithms: ['RS256'],
      });
      if (!payload.sub || !payload.email) {
        return null;
      }
      return { sub: payload.sub, email: payload.email };
    } catch (error) {
      this.logger.debug(
        `Socket handshake rejected: ${error instanceof Error ? error.message : 'invalid token'}`,
      );
      return null;
    }
  }
}
