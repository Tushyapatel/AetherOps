/**
 * AtherOps Backend – PostgreSQL Database Connection Pool
 *
 * Uses the `pg` (node-postgres) Pool.
 *
 * Key design decisions:
 *  - The pool is created lazily but the connection test at startup is explicit.
 *  - checkHealth() never throws – it returns a typed result so callers can
 *    handle degraded state without crashing.
 *  - disconnect() drains the pool gracefully for clean shutdown.
 *  - No schema modifications are performed here.
 */

import { Pool, PoolClient, DatabaseError } from 'pg';
import { config } from '../config';
import { logger } from '../logger';

// ── Pool singleton ─────────────────────────────────────────────────────────────

let pool: Pool | null = null;

function createPool(): Pool {
  return new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
    min: config.db.pool.min,
    max: config.db.pool.max,
    idleTimeoutMillis: config.db.pool.idleTimeoutMs,
    connectionTimeoutMillis: config.db.pool.connectionTimeoutMs,
    // Use SSL in production but not in development/test unless explicitly set
    ssl: config.isProduction ? { rejectUnauthorized: true } : false,
  });
}

/**
 * Returns the shared Pool, creating it on first call.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();

    pool.on('connect', () => {
      logger.debug('PostgreSQL: new client connected to pool');
    });

    pool.on('error', (err: Error) => {
      logger.error('PostgreSQL: unexpected pool client error', {
        error: err.message,
        code: (err as DatabaseError).code,
      });
    });

    pool.on('remove', () => {
      logger.debug('PostgreSQL: client removed from pool');
    });
  }
  return pool;
}

// ── Typed health result ───────────────────────────────────────────────────────

export type DbHealthStatus = 'healthy' | 'unhealthy';

export interface DbHealthResult {
  status: DbHealthStatus;
  latencyMs: number | null;
  serverVersion: string | null;
  error: string | null;
}

/**
 * Runs a lightweight query to verify database connectivity.
 * Always resolves – never rejects.
 */
export async function checkDbHealth(): Promise<DbHealthResult> {
  const start = Date.now();
  let client: PoolClient | null = null;

  try {
    client = await getPool().connect();
    const result = await client.query<{ version: string; now: Date }>(
      'SELECT version(), NOW() AS now',
    );
    const latencyMs = Date.now() - start;
    const versionRow = result.rows[0];
    const serverVersion = versionRow?.version?.split(' ').slice(0, 2).join(' ') ?? null;

    logger.debug('PostgreSQL health check passed', { latencyMs, serverVersion });

    return { status: 'healthy', latencyMs, serverVersion, error: null };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);

    logger.warn('PostgreSQL health check failed', { error: message });

    return { status: 'unhealthy', latencyMs, serverVersion: null, error: message };
  } finally {
    client?.release();
  }
}

/**
 * Attempts to connect to the database during application startup.
 * Logs result but does NOT crash the process on failure –
 * the health endpoint will surface the degraded state.
 */
export async function connectDb(): Promise<void> {
  logger.info('PostgreSQL: establishing initial connection…', {
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    poolMin: config.db.pool.min,
    poolMax: config.db.pool.max,
  });

  const health = await checkDbHealth();

  if (health.status === 'healthy') {
    logger.info('PostgreSQL: connected successfully', {
      serverVersion: health.serverVersion,
      latencyMs: health.latencyMs,
    });
  } else {
    logger.warn(
      'PostgreSQL: initial connection failed – application will start in degraded mode',
      { error: health.error },
    );
  }
}

/**
 * Gracefully ends the pool, releasing all connections.
 * Call during application shutdown.
 */
export async function disconnectDb(): Promise<void> {
  if (pool) {
    logger.info('PostgreSQL: draining connection pool…');
    await pool.end();
    pool = null;
    logger.info('PostgreSQL: pool closed');
  }
}

/**
 * Convenience wrapper: acquire a client, run a callback, release the client.
 * Handles release even if the callback throws.
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a parameterised query directly on the pool.
 * Use this for simple, non-transactional queries.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) {
  return getPool().query<T>(text, params);
}
