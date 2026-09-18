import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
// Surface missing indexes in dev instead of silently doing collection scans.
mongoose.set('autoIndex', env.NODE_ENV !== 'production');

export async function connectDb(uri = env.MONGODB_URI) {
  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.connection.close();
}
