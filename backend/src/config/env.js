import 'dotenv/config';
import { z } from 'zod';

/**
 * A connection string that is merely non-empty is not a connection string.
 *
 * The three ways this goes wrong in practice, in order of frequency:
 *   1. the placeholder was never replaced
 *   2. Atlas's <password> was left as-is
 *   3. someone pasted a dashboard URL instead of the driver string
 *
 * Catching them here turns a stack trace from deep inside the mongo driver
 * into one line naming the field and what to do about it.
 */
const mongoUri = z
  .string()
  .min(1, 'is required')
  .refine(
    (v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'),
    'must start with mongodb:// or mongodb+srv:// — copy the driver connection '
      + 'string, not the browser URL',
  )
  .refine(
    (v) => !/[<>]/.test(v),
    'still contains a placeholder in angle brackets — replace <password> (and '
      + 'any others) with the real value',
  );

/**
 * Every environment variable the server needs, validated at boot.
 * If one is missing or malformed the process refuses to start — a loud failure
 * at 09:00 beats a silent one at 03:00.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  // z.string().url() alone accepts "localhost:3000", which parses as a URL
  // with the scheme "localhost:". CORS would then never match and nothing
  // would say why, so require a real http(s) origin.
  CLIENT_URL: z
    .string()
    .url()
    .refine(
      (v) => /^https?:\/\//.test(v),
      'must include the scheme, for example http://localhost:3000',
    )
    .default('http://localhost:3000'),

  MONGODB_URI: mongoUri,

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** The database a connection string names, or null when it names none. */
export function databaseNameFrom(uri = '') {
  const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/, '');
  const dbName = afterHost.split('?')[0].replace(/^\//, '');
  return dbName || null;
}

/** Used when the connection string names no database. */
export const DEFAULT_DB_NAME = 'reclaimos';

/**
 * Not fatal — connectDb falls back to DEFAULT_DB_NAME — but worth saying out
 * loud, because a string with no database name would otherwise put everything
 * in a database called "test", which is bewildering the first time you go
 * looking for your data.
 */
export function databaseNameWarning(uri = '') {
  if (databaseNameFrom(uri)) return null;
  return `MONGODB_URI names no database, so "${DEFAULT_DB_NAME}" will be used. `
    + 'To be explicit, add it before the "?" — for example '
    + '.mongodb.net/reclaimos?retryWrites=true';
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(
    `\nInvalid environment configuration in backend/.env:\n${issues}\n\n`
      + '  Copy backend/.env.example if you have not already, and fill in\n'
      + '  MONGODB_URI, JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.\n',
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

const warning = databaseNameWarning(env.MONGODB_URI);
if (warning && !isTest) console.error(`Warning: ${warning}\n`);
