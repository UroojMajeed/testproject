import mongoose from 'mongoose';
import { env, databaseNameFrom, DEFAULT_DB_NAME } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
// Surface missing indexes in dev instead of silently doing collection scans.
mongoose.set('autoIndex', env.NODE_ENV !== 'production');

/**
 * Registered once at module load, not inside connectDb.
 *
 * The connection is a singleton, so attaching listeners per call stacks them —
 * every caller would add another copy, giving duplicated log lines and
 * eventually a MaxListenersExceededWarning.
 */
mongoose.connection.on('connected', () => logger.info('mongo connected'));
mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));

/**
 * Index builds fail silently otherwise, and that is worse than it sounds.
 *
 * With autoIndex on, Mongoose builds each model's indexes in the background. If
 * one fails — most often IndexKeySpecsConflict, an index of the same name left by
 * an older version of the schema — Mongoose stores the error on the model and says
 * nothing. The app keeps serving, the index quietly stays as it was, and a `unique`
 * constraint you believe you have simply is not there.
 *
 * Verified: planting a non-unique index where Activity expects a unique one leaves
 * the collection with unique=false, no log line, and a perfectly healthy server.
 */
export async function reportIndexProblems(models = Object.values(mongoose.models)) {
  const failures = [];

  await Promise.all(models.map(async (model) => {
    try {
      await model.init();
    } catch (err) {
      failures.push({ model: model.modelName, message: err.message });
      logger.error(
        { err, model: model.modelName },
        'index build failed — the constraint you expect is not in place',
      );
    }
  }));

  return failures;
}

export async function connectDb(uri = env.MONGODB_URI) {
  // A connection string with no database name would otherwise land everything
  // in "test". Only set dbName when the URI does not already say, so a
  // deliberate choice is never overridden.
  const named = databaseNameFrom(uri);
  const options = { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 };
  if (!named) options.dbName = DEFAULT_DB_NAME;

  await mongoose.connect(uri, options);
  logger.info({ database: named ?? DEFAULT_DB_NAME }, 'mongo ready');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.connection.close();
}
