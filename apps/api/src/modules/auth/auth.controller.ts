import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  AUTH_REFRESH_COOKIE_NAME,
  type UserDto,
} from '@capitalflow/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { EnvConfig } from '../../config/env.schema';
import {
  buildClearRefreshCookieOptions,
  buildRefreshCookieOptions,
} from './auth.cookies';
import { AuthService } from './auth.service';
import {
  RefreshTokenGuard,
  type RequestWithRefreshToken,
} from './guards/refresh-token.guard';
import { registerBodySchema, type RegisterDto } from './dto/register.dto';
import { loginBodySchema, type LoginDto } from './dto/login.dto';

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
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
}
