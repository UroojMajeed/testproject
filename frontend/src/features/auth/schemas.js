import { z } from 'zod';

/**
 * Mirrors backend/src/modules/auth/auth.validation.js. The server is the
 * authority — this exists so the user sees the same rule before a round trip,
 * not so the client can decide what is valid.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop12',
  'letmein12345', 'iloveyou1234', 'administrator', 'welcome12345',
  'changeme1234', 'passw0rd1234', 'abcd12345678',
]);

export const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'That is longer than 128 characters')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'That password is too common — pick another')
  .refine((v) => !/^(.)\1+$/.test(v), 'That password is a single repeated character');

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Your name is required').max(120),
    email,
    password,
  })
  .superRefine((data, ctx) => {
    const pwd = data.password.toLowerCase();
    const local = data.email.split('@')[0]?.toLowerCase() ?? '';
    const name = data.name.toLowerCase().replace(/\s+/g, '');
    if ((local.length >= 4 && pwd.includes(local)) || (name.length >= 4 && pwd.includes(name))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Do not base your password on your name or email',
      });
    }
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'The two passwords do not match' });

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Give your workspace a name').max(120),
  industry: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().length(3),
});

export const goalSchema = z.object({
  currentWeeklyHours: z.coerce.number().min(1, 'How many hours a week do you work now?').max(168),
  targetWeeklyHours: z.coerce.number().min(1, 'What would you like it to be?').max(168),
  annualCompensation: z.coerce.number().min(0, 'Enter a number').max(10_000_000),
  annualHours: z.coerce.number().min(1, 'Enter at least 1 hour').max(8760),
});
