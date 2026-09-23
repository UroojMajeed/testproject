import { z } from 'zod';

/**
 * Deliberately the same rules, and the same wording, as
 * backend/src/modules/auth/auth.validation.js.
 *
 * This is a duplicate and that is the point: the client copy exists to answer in
 * the same keystroke rather than after a round trip, and the server copy exists
 * because a client check is a courtesy, not a control. Neither replaces the other.
 *
 * The wording matches so that a rule caught here and the same rule caught there
 * read identically — a user who sees one message on blur and a different one on
 * submit assumes the app is broken, and they are not wrong to.
 *
 * If you change a rule, change it in both files. The two live in each other's
 * comments for exactly that reason.
 */

const COMMON = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop12',
  'letmein12345', 'iloveyou1234', 'administrator', 'welcome12345',
  'changeme1234', 'passw0rd1234', 'abcd12345678',
]);

export const PASSWORD_MIN = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, 'Use at least 12 characters')
  .max(128, 'That is longer than 128 characters')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'That password is too common — pick another')
  .refine((v) => !/^(.)\1+$/.test(v), 'That password is a single repeated character');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Your email address is required')
  .email('Enter a valid email address')
  .max(254);

const nameSchema = z.string().trim().min(1, 'Your name is required').max(120);

/** Mirrors notDerivedFromIdentity on the server. */
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

export const registerSchema = z
  .object({ name: nameSchema, email: emailSchema, password: passwordSchema })
  .superRefine(notDerivedFromIdentity);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Both passwords must match',
  });

/**
 * Guidance, not a meter.
 *
 * A strength bar invites people to game the bar — one capital and a "1" on the end
 * scores well and resists nothing. Length is what actually helps, so say that.
 */
export const PASSWORD_HINT =
  'At least 12 characters. A short phrase you will remember beats a short word with symbols in it.';
