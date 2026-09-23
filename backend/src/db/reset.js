/**
 * Drops every collection in the configured database.
 *
 * Built for step-by-step development, where wiping and starting again is
 * routine. It refuses outright in production, prints what it is about to destroy,
 * and requires --yes so it can never be a slip of the shell history.
 *
 * Usage: npm run db:reset -- --yes
 */
import mongoose from 'mongoose';
import { env, isProd, databaseNameFrom, DEFAULT_DB_NAME } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';

/* eslint-disable no-console */

async function main() {
  if (isProd) {
    console.error('\n  Refusing to run: NODE_ENV is production.\n');
    process.exit(1);
  }

  const confirmed = process.argv.includes('--yes');
  const target = databaseNameFrom(env.MONGODB_URI) ?? DEFAULT_DB_NAME;

  await connectDb();
  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = collections.map((c) => c.name).sort();

  console.log(`\n  Database: ${mongoose.connection.db.databaseName}`);

  if (!names.length) {
    console.log('  Already empty — nothing to do.\n');
    await disconnectDb();
    process.exit(0);
  }

  console.log(`  ${names.length} collection(s): ${names.join(', ')}`);

  if (!confirmed) {
    console.log(`\n  This will permanently delete all of it from "${target}".`);
    console.log('  Nothing has been changed. To go ahead:\n');
    console.log('      npm run db:reset -- --yes\n');
    await disconnectDb();
    process.exit(0);
  }

  for (const name of names) {
    await mongoose.connection.db.dropCollection(name);
    console.log(`  dropped ${name}`);
  }

  console.log(`\n  Done. "${mongoose.connection.db.databaseName}" is empty.\n`);
  await disconnectDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n  Reset failed:', err.message, '\n');
  await disconnectDb().catch(() => {});
  process.exit(1);
});
