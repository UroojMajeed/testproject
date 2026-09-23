/**
 * Which theme the interface is in.
 *
 * Three states, not two. 'system' follows the operating system and is the default,
 * because most people have already made this choice once and do not want to make it
 * again per site. 'light' and 'dark' are explicit overrides.
 *
 * ── On the storage rule ────────────────────────────────────────────────────
 * This file is the single exception to the ban in eslint.config.js, and the
 * exception is scoped to this file there rather than relaxed globally.
 *
 * The rule exists because an access token in storage is readable by any script that
 * reaches the page and outlives the tab — one injection becomes a standing session.
 * A theme preference is the opposite case: worthless to an attacker, and it *needs*
 * to outlive the tab or the setting does not work. Everything a token must not be.
 *
 * Nothing else may reach for storage. If a second exception is ever proposed, it
 * should have to answer the same question this one does.
 */

const STORAGE_KEY = 'reclaimos-theme';
export const THEMES = Object.freeze(['system', 'light', 'dark']);

/**
 * Storage throws in a private window, and returns nothing with site data blocked.
 * Every read and write is guarded, and the app renders correctly when it fails —
 * the theme simply falls back to following the system.
 */
function readStored() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function writeStored(theme) {
  try {
    if (theme === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not a reason to refuse to apply it.
  }
}

export function getStoredTheme() {
  return readStored();
}

/**
 * Writes the choice to <html data-theme>, which is what the CSS in _tokens.scss
 * keys off. 'system' removes the attribute so the media query decides again.
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  return theme;
}

export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : 'system';
  writeStored(next);
  return applyTheme(next);
}

/** What the reader is actually looking at, with 'system' resolved. */
export function resolveTheme(theme = readStored()) {
  if (theme !== 'system') return theme;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Applies the stored choice as early as possible.
 *
 * Called from main.jsx before React renders. Any later and the page paints in the
 * wrong theme first — the white flash on a dark-mode machine that makes a site feel
 * cheaply made.
 */
export function initTheme() {
  return applyTheme(readStored());
}
