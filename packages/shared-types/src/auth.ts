import { z } from 'zod';

// Single source of truth for password complexity (AC44)
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: Pick<UserDto, 'id' | 'email' | 'name'>;
}
