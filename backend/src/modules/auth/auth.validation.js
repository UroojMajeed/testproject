import { z } from 'zod';

/**
 * Length beats composition rules. NIST 800-63B advises against forced symbol
 * classes and in favour of a longer minimum plus a blocklist of known-common
 * passwords, which is what this does.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop12',
  'letmein12345', 'iloveyou1234', 'administrator', 'welcome12345',
  'changeme1234', 'passw0rd1234', 'abcd12345678',
]);

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'That is longer than 128 characters')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'That password is too common — pick another')
  .refine((v) => !/^(.)\1+$/.test(v), 'That password is a single repeated character');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

const nameSchema = z.string().trim().min(1, 'Your name is required').max(120);

/** Rejects a password that simply restates the email local part or the name. */
function notDerivedFromIdentity(data, ctx) {
  const pwd = data.password.toLowerCase();
  const local = data.email.split('@')[0].toLowerCase();
  const name = data.name.toLowerCase().replace(/\s+/g, '');
  if ((local.length >= 4 && pwd.includes(local)) || (name.length >= 4 && pwd.includes(name))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: 'Do not base your password on your name or email',
    });
  }
}

export const registerSchema = {
  body: z
    .object({
      name: nameSchema,
      email: emailSchema,
      password: passwordSchema,
      timezone: z.string().max(64).optional(),
    })
    .strict()
    .superRefine(notDerivedFromIdentity),
};

export const loginSchema = {
  body: z
    .object({
      email: emailSchema,
      password: z.string().min(1, 'Enter your password').max(128),
    })
    .strict(),
};

export const forgotPasswordSchema = { body: z.object({ email: emailSchema }).strict() };

export const resetPasswordSchema = {
  body: z
    .object({
      token: z.string().min(20).max(200),
      password: passwordSchema,
    })
    .strict(),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema,
    })
    .strict()
    .refine((d) => d.currentPassword !== d.newPassword, {
      path: ['newPassword'],
      message: 'Choose a password you have not used here before',
    }),
};

export const verifyEmailSchema = { body: z.object({ token: z.string().min(20).max(200) }).strict() };
