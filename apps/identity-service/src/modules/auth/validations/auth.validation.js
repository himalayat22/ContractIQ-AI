import { z } from 'zod';
import { validateBody, validateParams } from '../../../middleware/validateRequest.js';

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .max(255);

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    'Password must include upper, lower, number, and special character',
  );

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id format');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  organizationName: z.string().trim().min(1).max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  password: passwordSchema,
});

export const switchTenantSchema = z.object({
  tenantId: objectIdSchema,
});

export const verifyEmailParamsSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const revokeSessionParamsSchema = z.object({
  sessionId: objectIdSchema,
});

export const validateRegister = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);
export const validateRefresh = validateBody(refreshSchema);
export const validateLogout = validateBody(logoutSchema);
export const validateForgotPassword = validateBody(forgotPasswordSchema);
export const validateResetPassword = validateBody(resetPasswordSchema);
export const validateSwitchTenant = validateBody(switchTenantSchema);
export const validateVerifyEmailParams = validateParams(verifyEmailParamsSchema);
export const validateRevokeSessionParams = validateParams(revokeSessionParamsSchema);
