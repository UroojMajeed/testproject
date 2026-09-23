import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAccessToken, setAccessToken, clearAccessToken, onAccessTokenChange } from './tokenStore.js';

describe('the access token store', () => {
  beforeEach(() => clearAccessToken());

  it('starts empty', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('holds and returns a token', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('treats undefined as cleared rather than storing it', () => {
    setAccessToken('abc.def.ghi');
    setAccessToken(undefined);
    expect(getAccessToken()).toBeNull();
  });

  it('tells subscribers when the token changes, and stops when unsubscribed', () => {
    const seen = vi.fn();
    const off = onAccessTokenChange(seen);

    setAccessToken('one');
    clearAccessToken();
    off();
    setAccessToken('two');

    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenNthCalledWith(1, 'one');
    expect(seen).toHaveBeenNthCalledWith(2, null);
  });

  /**
   * The rule this protects is the first one in CLAUDE.md. Storage is readable by any
   * script on the page and outlives the tab, so a token there turns one injection
   * into a standing session. There is an eslint rule as well; this is the belt.
   */
  it('never writes to localStorage or sessionStorage', () => {
    const local = vi.spyOn(window.localStorage.__proto__, 'setItem');
    const session = vi.spyOn(window.sessionStorage.__proto__, 'setItem');

    setAccessToken('must-not-be-persisted');

    expect(local).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
