import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessToken, setAccessToken, clearAccessToken, onTokenChange } from './tokenStore.js';

beforeEach(() => clearAccessToken());

describe('tokenStore', () => {
  it('holds the token in memory', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('never writes to localStorage or sessionStorage', () => {
    setAccessToken('abc.def.ghi');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears on demand', () => {
    setAccessToken('abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('normalises undefined to null', () => {
    setAccessToken(undefined);
    expect(getAccessToken()).toBeNull();
  });

  it('notifies subscribers and can unsubscribe', () => {
    const seen = [];
    const off = onTokenChange((t) => seen.push(t));
    setAccessToken('one');
    off();
    setAccessToken('two');
    expect(seen).toEqual(['one']);
  });
});
