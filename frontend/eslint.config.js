import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', fetch: 'readonly',
        Intl: 'readonly', console: 'readonly', localStorage: 'readonly',
        structuredClone: 'readonly', AbortController: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
      'no-console': ['warn', { allow: ['error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      // The whole point of tokenStore.js — fail the build if a token is
      // ever written to browser storage.
      'no-restricted-globals': ['error', { name: 'localStorage', message: 'Never store tokens or session data in browser storage.' }],
    },
  },
];
