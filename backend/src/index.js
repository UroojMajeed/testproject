import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb, reportIndexProblems } from './config/db.js';
import './models/index.js';

async function main() {
  await connectDb();

  // Before serving, not after: an index that failed to build is a constraint the
  // application believes it has and does not, and finding that out from corrupt
  // data later is the expensive version of this line.
  await reportIndexProblems();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'reclaimos api listening');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    // Do not let a hung connection hold the process open forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  /**
   * Shutting down on a stray rejection takes every in-flight request with it, and
   * the caller sees ECONNRESET rather than an error it can act on. The reason is
   * logged at fatal first, so the backend terminal always names what happened —
   * which is the only thing that makes this diagnosable from the outside.
   */
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandled rejection — shutting down');
    shutdown('unhandledRejection');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
