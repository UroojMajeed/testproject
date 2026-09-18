import { describe, it, expect } from 'vitest';
import { randomToken, hashToken, safeEqual, newFamilyId } from '../../src/utils/crypto.js';

describe('randomToken', () => {
  it('is url-safe', () => {
    for (let i = 0; i < 50; i += 1) expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => randomToken()));
    expect(seen.size).toBe(2000);
  });

  it('carries enough entropy by default', () => {
    // 48 bytes → 64 base64url characters.
    expect(randomToken().length).toBe(64);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('does not reveal the input', () => {
    const secret = 'a-real-refresh-token-value';
    expect(hashToken(secret)).not.toContain(secret);
    expect(hashToken(secret)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates inputs that differ by one character', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('safeEqual', () => {
  it('matches identical values', () => {
    expect(safeEqual('same-value', 'same-value')).toBe(true);
  });

  it('rejects different values of equal length', () => {
    expect(safeEqual('abcdef', 'abcdeg')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(safeEqual('short', 'considerably-longer')).toBe(false);
  });

  it('handles empty input', () => {
    expect(safeEqual('', '')).toBe(true);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('newFamilyId', () => {
  it('produces unique uuids', () => {
    const ids = new Set(Array.from({ length: 500 }, newFamilyId));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
