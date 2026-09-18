/**
 * The access token lives in a module variable — in memory, for the lifetime of
 * the tab and no longer.
 *
 * It is deliberately NOT in localStorage or sessionStorage: anything readable
 * by JavaScript is readable by injected JavaScript, and an XSS bug would hand
 * an attacker a valid bearer token. The long-lived credential is the refresh
 * cookie, which is httpOnly and therefore invisible to this code.
 */
let accessToken = null;
const listeners = new Set();

export const getAccessToken = () => accessToken;

export function setAccessToken(next) {
  accessToken = next ?? null;
  listeners.forEach((fn) => fn(accessToken));
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function onTokenChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
