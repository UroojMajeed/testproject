import mongoose from 'mongoose';
import { env, databaseNameFrom, DEFAULT_DB_NAME } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
// Surface missing indexes in dev instead of silently doing collection scans.
mongoose.set('autoIndex', env.NODE_ENV !== 'production');

/**
 * Registered once at module load, not inside connectDb.
 *
 * The connection is a singleton, so attaching listeners per call stacks them:
 * index.js, seed.js and the integration setup each call connectDb, and every
 * caller would add another copy. You get duplicated log lines and eventually a
 * MaxListenersExceededWarning.
 */
mongoose.connection.on('connected', () => logger.info('mongo connected'));
mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));

export async function connectDb(uri = env.MONGODB_URI) {
  // A connection string with no database name would otherwise land everything
  // in "test". Only set dbName when the URI does not already say — passing it
  // unconditionally would override a deliberate choice.
  const named = databaseNameFrom(uri);
  const options = {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  };
  if (!named) options.dbName = DEFAULT_DB_NAME;

  await mongoose.connect(uri, options);
  logger.info({ database: named ?? DEFAULT_DB_NAME }, 'mongo ready');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.connection.close();
}
