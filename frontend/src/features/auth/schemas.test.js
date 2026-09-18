import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from './schemas.js';

const good = { name: 'Urooj Majeed', email: 'founder@example.com', password: 'correct-horse-battery-staple' };

describe('registerSchema', () => {
  it('accepts a valid signup', () => {
    expect(registerSchema.safeParse(good).success).toBe(true);
  });

  it('applies the same rules as the server', () => {
    expect(registerSchema.safeParse({ ...good, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, password: 'password123' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, password: 'my-founder-pass' }).success).toBe(false);
  });

  it('normalises the email', () => {
    const r = registerSchema.safeParse({ ...good, email: '  Founder@Example.com ' });
    expect(r.data.email).toBe('founder@example.com');
  });
});

describe('loginSchema', () => {
  it('does not apply the strength policy to sign-in', () => {
    // An existing account may predate a policy change; sign-in must not block it.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'old' }).success).toBe(true);
  });

  it('still requires a password to be present', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires the two entries to match', () => {
    const r = resetPasswordSchema.safeParse({ password: 'a-long-enough-phrase', confirm: 'something-else-x' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['confirm']);
  });

  it('passes when they match', () => {
    expect(resetPasswordSchema.safeParse({
      password: 'a-long-enough-phrase', confirm: 'a-long-enough-phrase',
    }).success).toBe(true);
  });
});
