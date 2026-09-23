import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, resetPasswordSchema, passwordSchema } from './schemas.js';

/**
 * These assertions are copied in spirit from the backend's password-policy tests,
 * and that is intentional. Client validation exists so the answer arrives in the
 * same keystroke; the server's copy is the one that actually decides. If they ever
 * disagree, a user gets told one thing on blur and another on submit, and concludes
 * the app is broken.
 */

const firstMessage = (result, path) =>
  result.error?.issues.find((i) => i.path.join('.') === path)?.message;

describe('the password rule', () => {
  it.each([
    'correct-horse-battery-staple',
    'the cat sat on a very long mat',
    'Tuesday-is-for-invoices',
  ])('accepts a memorable phrase: %s', (pwd) => {
    expect(passwordSchema.safeParse(pwd).success).toBe(true);
  });

  it('asks for twelve characters, not for symbols', () => {
    // Short but full of symbols: rejected. Long and plain: accepted. Length is the
    // thing that resists a guess, so length is the thing we ask for.
    expect(passwordSchema.safeParse('Aa1!Aa1!').success).toBe(false);
    expect(passwordSchema.safeParse('sixteen plain ones').success).toBe(true);
  });

  it.each([
    ['passw0rd1234', /too common/],
    ['aaaaaaaaaaaaaa', /single repeated character/],
    ['short', /at least 12/],
  ])('rejects %s', (pwd, expected) => {
    const result = passwordSchema.safeParse(pwd);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(expected);
  });

  it('stops at 128 characters', () => {
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
});

describe('the sign up form', () => {
  const valid = { name: 'Urooj Majeed', email: 'founder@example.com', password: 'correct-horse-battery-staple' };

  it('accepts a complete, sensible submission', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('lower-cases and trims the email, matching what the server will store', () => {
    const result = registerSchema.safeParse({ ...valid, email: '  Founder@Example.COM  ' });
    expect(result.data.email).toBe('founder@example.com');
  });

  it('refuses a password built out of the email address', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'founder-founder-x' });
    expect(firstMessage(result, 'password')).toMatch(/name or email/);
  });

  it('refuses a password built out of the name', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'uroojmajeed-2026' });
    expect(firstMessage(result, 'password')).toMatch(/name or email/);
  });

  it.each([
    ['name', { name: '   ' }],
    ['email', { email: 'not-an-address' }],
  ])('requires a usable %s', (field, over) => {
    const result = registerSchema.safeParse({ ...valid, ...over });
    expect(result.success).toBe(false);
    expect(firstMessage(result, field)).toBeTruthy();
  });
});

describe('the sign in form', () => {
  it('does not apply the password policy — an old password must still be submittable', () => {
    // Holding sign in to the sign-up rules would lock out anyone whose password
    // predates the policy, and tell them nothing useful about why.
    const result = loginSchema.safeParse({ email: 'founder@example.com', password: 'short' });
    expect(result.success).toBe(true);
  });

  it('still wants something in the password box', () => {
    const result = loginSchema.safeParse({ email: 'founder@example.com', password: '' });
    expect(firstMessage(result, 'password')).toMatch(/Enter your password/);
  });
});

describe('the reset form', () => {
  const pwd = 'a-completely-different-secret';

  it('accepts two matching passwords', () => {
    expect(resetPasswordSchema.safeParse({ password: pwd, confirmPassword: pwd }).success).toBe(true);
  });

  it('puts the mismatch message on the confirmation field, where the user is looking', () => {
    const result = resetPasswordSchema.safeParse({ password: pwd, confirmPassword: `${pwd}x` });
    expect(firstMessage(result, 'confirmPassword')).toMatch(/must match/);
  });

  it('holds the new password to the full policy', () => {
    expect(resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success).toBe(false);
  });
});
