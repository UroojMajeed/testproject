/**
 * The environment the test suites run in.
 *
 * Tests used to inherit whatever was in backend/.env, which had two problems. A
 * fresh clone could not run them at all — config/env.js validates at boot and
 * exits, so `npm test` died at import with three "Required" messages and no test
 * ever ran. And on a machine that did have a .env, the suite was running against
 * somebody's real secrets and real connection string, so results depended on a
 * file that is deliberately not in the repository.
 *
 * Vitest applies these before any module loads, and dotenv does not overwrite a
 * variable that is already set, so these win over .env rather than merging with
 * it. Tests are the same everywhere as a result.
 *
 * The secrets are obvious fakes and only need to satisfy the 32-character rule.
 * Nothing here is a credential; the database is never reached by the unit suite,
 * and the integration suite overrides MONGODB_URI with its own in-memory server.
 */
export const testEnv = {
  NODE_ENV: 'test',
  PORT: '5000',
  CLIENT_URL: 'http://localhost:3000',

  MONGODB_URI: 'mongodb://127.0.0.1:27017/reclaimos-test',

  JWT_ACCESS_SECRET: 'test-access-secret-not-a-real-one-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-not-a-real-one-9876543210',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL_DAYS: '7',

  // The floor the schema allows. Real cost is 12; bcrypt at 12 turns a suite that
  // signs in a few dozen times into a coffee break.
  BCRYPT_ROUNDS: '10',
  MAX_LOGIN_ATTEMPTS: '5',
  LOCKOUT_MINUTES: '15',

  LOG_LEVEL: 'silent',
};
