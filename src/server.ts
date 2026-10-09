/**
 * AtherOps Backend – Server Entry Point
 *
 * Responsibilities:
 *  1. Load environment variables from .env (dotenv)
 *  2. Validate configuration (config module will exit on failure)
 *  3. Probe the database
 *  4. Start the HTTP server
 *  5. Register graceful shutdown handlers
 *
 * This file should NOT be imported by tests. Import app.ts instead.
 */

// Load .env before anything else reads process.env
import 'dotenv/config';

import http from 'http';
import { config } from './config';
import { logger } from './logger';
import { connectDb, disconnectDb } from './database';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  logger.info('AtherOps backend starting…', {
    environment: config.env,
    port: config.server.port,
    apiPrefix: config.api.fullPrefix,
    logLevel: config.server.logLevel,
  });

  // ── Database startup probe ─────────────────────────────────────────────────
  await connectDb();

  // ── Security Rules Sync ────────────────────────────────────────────────────
  const { syncRulesToDb } = await import('./modules/security/rules/rule.loader');
  await syncRulesToDb();

  // ── HTTP server ────────────────────────────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.listen(config.server.port, () => resolve());
    server.once('error', reject);
  });

  logger.info(`AtherOps backend is ready`, {
    url: `http://localhost:${config.server.port}`,
    health: `http://localhost:${config.server.port}${config.api.fullPrefix}/health`,
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal: string): void {
    logger.info(`Received ${signal} – shutting down gracefully…`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
      }

      // Drain the database pool
      disconnectDb().then(() => {
        logger.info('Shutdown complete');
        process.exit(err ? 1 : 0);
      }).catch((dbErr: unknown) => {
        logger.error('Error disconnecting DB during shutdown', { error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
        process.exit(1);
      });
    });

    // Force-exit after 10 seconds if connections don't drain
    setTimeout(() => {
      logger.warn('Graceful shutdown timeout exceeded – forcing exit');
      process.exit(1);
    }, 10_000).unref();
  }

  process.once('SIGTERM', () => { shutdown('SIGTERM'); });
  process.once('SIGINT', () => { shutdown('SIGINT'); });

  // ── Unhandled promise rejections ───────────────────────────────────────────
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception – shutting down', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
