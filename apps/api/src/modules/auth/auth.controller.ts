import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { UserDto } from '@capitalflow/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { registerBodySchema, type RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterDto,
  ): Promise<UserDto> {
    return this.authService.register(body);
  }
}
