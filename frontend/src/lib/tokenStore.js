/**
 * Where the access token lives: a module variable, and nowhere else.
 *
 * Not localStorage, not sessionStorage, not a cookie the client can read. Any
 * script that gets onto the page can read storage, and storage outlives the tab —
 * an XSS on Tuesday would still have a token on Friday. A module variable dies
 * with the tab, so the blast radius of a script injection is that one page load.
 *
 * The cost is that a refresh loses the token. That is fine: the refresh cookie is
 * httpOnly, the app calls /auth/refresh on boot, and a new access token comes
 * back. AuthContext does exactly that.
 *
 * There is an eslint rule in eslint.config.js that fails the build if anything
 * under src/ reaches for browser storage.
 */

let accessToken = null;

/** Called when the token changes, so apiClient can react without importing React. */
const listeners = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(next) {
  accessToken = next ?? null;
  listeners.forEach((fn) => fn(accessToken));
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function onAccessTokenChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
