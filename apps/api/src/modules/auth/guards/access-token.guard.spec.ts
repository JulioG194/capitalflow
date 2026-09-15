import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard, type RequestWithUser } from './access-token.guard';

function makeContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  let jwtService: { verifyAsync: jest.Mock };
  let guard: AccessTokenGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new AccessTokenGuard(jwtService as unknown as JwtService);
  });

  it('AC27: rejects a request with no Authorization header', async () => {
    const context = makeContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('AC27: rejects a malformed Authorization header (no Bearer scheme)', async () => {
    const context = makeContext({
      headers: { authorization: 'Basic abc123' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('AC27: rejects an expired/invalid token (verify throws)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = makeContext({
      headers: { authorization: 'Bearer expired.token.value' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('AC26: attaches the decoded payload to the request and allows the request through', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
    });
    const request: Partial<RequestWithUser> = {
      headers: { authorization: 'Bearer valid.token.value' },
    };
    const context = makeContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
    });
  });
});
