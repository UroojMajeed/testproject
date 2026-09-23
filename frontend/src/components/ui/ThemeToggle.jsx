import { useEffect, useState } from 'react';
import { getStoredTheme, setTheme, resolveTheme } from '../../lib/theme.js';

/**
 * Cycles system → light → dark → system.
 *
 * A three-state cycle rather than a two-state switch, because "follow my computer"
 * is a real preference and a plain toggle silently throws it away the first time it
 * is touched. The label says the current state and the title says what a press will
 * do, so neither a screen reader nor a mouse user has to guess.
 */
const NEXT = { system: 'light', light: 'dark', dark: 'system' };

const LABEL = {
  system: 'Theme: following your system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

function Icon({ theme }) {
  if (theme === 'system') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="2.5" y="4" width="19" height="13" rx="2" />
        <path d="M8.5 20.5h7" strokeLinecap="round" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeToggle({ className = '' }) {
  const [theme, setThemeState] = useState('system');

  // Read on mount rather than in useState: the value comes from localStorage and
  // from matchMedia, neither of which exists while the server-less build is being
  // prerendered or while a test runs without a DOM.
  useEffect(() => setThemeState(getStoredTheme()), []);

  const change = () => setThemeState(setTheme(NEXT[theme]));

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={change}
      // The state, for anyone who cannot see which icon is showing.
      aria-label={LABEL[theme]}
      title={`${LABEL[theme]} — press to switch to ${NEXT[theme]}`}
      data-theme-state={theme}
      data-theme-resolved={resolveTheme(theme)}
    >
      <Icon theme={theme} />
    </button>
  );
}
