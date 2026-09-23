import { describe, it, expect } from 'vitest';
import { registerSchema, passwordSchema, emailSchema } from '../../src/modules/auth/auth.validation.js';

const base = { name: 'Urooj Majeed', email: 'founder@example.com' };
const parse = (password) => registerSchema.body.safeParse({ ...base, password });
const errs = (r) => r.error.issues.map((i) => i.path.join('.'));

describe('password policy', () => {
  it('accepts a long passphrase', () => {
    expect(parse('correct-horse-battery-staple').success).toBe(true);
  });

  it('rejects anything under 12 characters', () => {
    expect(passwordSchema.safeParse('elevenchar!').success).toBe(false);
    expect(passwordSchema.safeParse('twelvechars!').success).toBe(true);
  });

  it('rejects anything over 128 characters', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('rejects known-common passwords regardless of case', () => {
    for (const p of ['password123', 'PASSWORD123', 'Welcome12345', 'changeme1234']) {
      expect(passwordSchema.safeParse(p).success).toBe(false);
    }
  });

  it('rejects a single repeated character', () => {
    expect(passwordSchema.safeParse('aaaaaaaaaaaaaa').success).toBe(false);
  });

  it('rejects a password containing the email local part', () => {
    const r = parse('my-founder-password');
    expect(r.success).toBe(false);
    expect(errs(r)).toContain('password');
  });

  it('rejects a password containing the name', () => {
    const r = parse('uroojmajeed-secret-x');
    expect(r.success).toBe(false);
    expect(errs(r)).toContain('password');
  });

  it('does not force symbol or digit classes', () => {
    // NIST 800-63B: length and a blocklist, not composition rules.
    expect(passwordSchema.safeParse('quiet mountain river stone').success).toBe(true);
  });
});

describe('registration payload', () => {
  it('lowercases and trims the email', () => {
    const r = registerSchema.body.safeParse({
      ...base, email: '  FOUNDER@Example.COM  ', password: 'correct-horse-battery-staple',
    });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('founder@example.com');
  });

  it('refuses unknown keys so privilege fields cannot be smuggled in', () => {
    const r = registerSchema.body.safeParse({
      ...base, password: 'correct-horse-battery-staple', status: 'active', tokenVersion: 42,
    });
    expect(r.success).toBe(false);
  });

  it('requires a name', () => {
    expect(registerSchema.body.safeParse({ ...base, name: '   ', password: 'correct-horse-battery-staple' }).success)
      .toBe(false);
  });
});

describe('email schema', () => {
  it.each(['plain', 'no@tld', '@example.com', 'spaces in@example.com'])('rejects %s', (bad) => {
    expect(emailSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a normal address', () => {
    expect(emailSchema.safeParse('a.b+tag@sub.example.co.uk').success).toBe(true);
  });
});
