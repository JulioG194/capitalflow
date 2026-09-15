import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AUTH_REFRESH_COOKIE_NAME,
  type UserDto,
} from '@capitalflow/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { EnvConfig } from '../../config/env.schema';
import {
  buildClearRefreshCookieOptions,
  buildRefreshCookieOptions,
  readRefreshCookie,
} from './auth.cookies';
import { AuthService } from './auth.service';
import {
  RefreshTokenGuard,
  type RequestWithRefreshToken,
} from './guards/refresh-token.guard';
import {
  AccessTokenGuard,
  type RequestWithUser,
} from './guards/access-token.guard';
import { registerBodySchema, type RegisterDto } from './dto/register.dto';
import { loginBodySchema, type LoginDto } from './dto/login.dto';
import {
  forgotPasswordBodySchema,
  type ForgotPasswordDto,
} from './dto/forgot-password.dto';
import {
  resetPasswordBodySchema,
  type ResetPasswordDto,
} from './dto/reset-password.dto';
import {
  updateProfileBodySchema,
  type UpdateProfileDto,
} from './dto/update-profile.dto';

interface LoginResponseBody {
  accessToken: string;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
}

interface RefreshResponseBody {
  accessToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterDto,
  ): Promise<UserDto> {
    return this.authService.register(body);
  }

  /**
   * AC6/AC11: responds with the access token in the JSON body and sets the
   * raw refresh token only as an `HttpOnly` cookie — it is never present in
   * the response body.
   *
   * AC30/AC31: rate-limited via the module-level `ThrottlerModule` config
   * (5 requests/60s/IP by default, from `LOGIN_RATE_LIMIT_MAX`/
   * `LOGIN_RATE_LIMIT_WINDOW_SECONDS`) — `ThrottlerGuard` is applied only
   * to this one method, not globally, and sets `Retry-After` on the
   * throttled response itself.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseBody> {
    const result = await this.authService.login(body);

    res.cookie(
      AUTH_REFRESH_COOKIE_NAME,
      result.refreshToken,
      buildRefreshCookieOptions(this.config),
    );

    return { accessToken: result.accessToken, user: result.user };
  }

  /**
   * AC12-17: rotates the presented refresh token. `RefreshTokenGuard`
   * rejects a missing cookie before this method (or any DB call) runs
   * (AC17). On any failure from `AuthService.refresh` (expired, reused,
   * unknown) the cookie is cleared and the exception is rethrown as-is so
   * the client still sees the expected 401.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  async refresh(
    @Req() req: RequestWithRefreshToken,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseBody> {
    try {
      const result = await this.authService.refresh(req.rawRefreshToken);

      res.cookie(
        AUTH_REFRESH_COOKIE_NAME,
        result.refreshToken,
        buildRefreshCookieOptions(this.config),
      );

      return { accessToken: result.accessToken };
    } catch (error) {
      res.clearCookie(
        AUTH_REFRESH_COOKIE_NAME,
        buildClearRefreshCookieOptions(this.config),
      );
      throw error;
    }
  }

  /**
   * AC18/AC19: intentionally unguarded — a missing or already-revoked
   * cookie still responds `200` (idempotent logout), never a `401`, so a
   * caller can't use this endpoint's status code to probe whether a
   * session existed.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    await this.authService.logout(readRefreshCookie(req));

    res.clearCookie(
      AUTH_REFRESH_COOKIE_NAME,
      buildClearRefreshCookieOptions(this.config),
    );

    return {};
  }

  /** AC20/AC21: always the same generic response shape either way. */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordBodySchema))
    body: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(body.email);
  }

  /**
   * AC22-25: `resetPasswordBodySchema` validates `newPassword`'s
   * complexity before this handler ever runs, so a complexity failure
   * never reaches (or consumes) the token in `AuthService.resetPassword`.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordBodySchema))
    body: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  /** AC26/AC27: `AccessTokenGuard` rejects a missing/malformed/expired token with 401. */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  getMe(@Req() req: RequestWithUser): Promise<UserDto> {
    return this.authService.getProfile(req.user.sub);
  }

  /**
   * AC28/AC29: only `name` is a permitted field — `updateProfileBodySchema`
   * rejects `email`/`password` (or any other field) via `.strict()`, and
   * rejects an empty body since `name` is required.
   */
  @Patch('me')
  @UseGuards(AccessTokenGuard)
  updateMe(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(updateProfileBodySchema))
    body: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.authService.updateProfile(req.user.sub, body);
  }
}
