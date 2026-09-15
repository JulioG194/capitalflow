import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  AUTH_REFRESH_COOKIE_NAME,
  type UserDto,
} from '@capitalflow/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { EnvConfig } from '../../config/env.schema';
import { buildRefreshCookieOptions } from './auth.cookies';
import { AuthService } from './auth.service';
import { registerBodySchema, type RegisterDto } from './dto/register.dto';
import { loginBodySchema, type LoginDto } from './dto/login.dto';

interface LoginResponseBody {
  accessToken: string;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
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
}
