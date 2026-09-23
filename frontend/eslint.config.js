import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * The storage rule is the one that matters.
 *
 * An access token in localStorage is readable by any script that gets onto the
 * page, and it survives the tab. Ours lives in a module variable in
 * lib/tokenStore.js and is re-obtained from the httpOnly refresh cookie on
 * reload, so there is never a reason to reach for storage here.
 */
const noBrowserStorage = {
  'no-restricted-globals': [
    'error',
    { name: 'localStorage', message: 'No tokens in browser storage — see lib/tokenStore.js.' },
    { name: 'sessionStorage', message: 'No tokens in browser storage — see lib/tokenStore.js.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'window', property: 'localStorage', message: 'No tokens in browser storage — see lib/tokenStore.js.' },
    { object: 'window', property: 'sessionStorage', message: 'No tokens in browser storage — see lib/tokenStore.js.' },
  ],
};

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...noBrowserStorage,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      /**
       * Off deliberately, not out of laziness.
       *
       * PropTypes are removed from React 19, so adding them now would be writing
       * a runtime check with a known expiry date. This project is plain JavaScript
       * by choice; what stands in for a type check here is that components are
       * small, props are destructured in the signature where they are visible, and
       * every screen has a test that renders it for real.
       */
      'react/prop-types': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    /**
     * The one file allowed to touch storage, and it is one file rather than a
     * relaxed rule.
     *
     * The ban exists because an access token in storage is readable by any script
     * that reaches the page and outlives the tab. A theme preference is the
     * opposite: worthless to an attacker, and useless unless it does outlive the
     * tab. src/lib/theme.js explains the distinction at more length; anything else
     * reaching for storage still fails the build.
     */
    files: ['src/lib/theme.js'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    /**
     * Browser tests. They run in Node, not in the page — the only browser globals
     * they touch are inside evaluate() callbacks, which are serialised and run in
     * Chromium, so the linter is right that they are not defined here. Declaring
     * both keeps it quiet without turning no-undef off.
     */
    files: ['e2e/**/*.js', 'playwright.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    // These are command-line tools. Printing what they did is their whole output,
    // and console.log also degrades gracefully when the reader pipes it into head.
    rules: { 'no-console': 'off' },
  },
  {
    // Tests legitimately stub fetch and assert on rendered output.
    files: ['src/test/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-refresh/only-export-components': 'off',
      // The storage ban is enforced here, so the tests that enforce it have to be
      // allowed to look. Reading storage to prove it is empty is the opposite of
      // the thing the rule is guarding against.
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
];
