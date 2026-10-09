/**
 * AtherOps Backend – Structured Logger
 *
 * Built on Winston. Provides:
 *  - JSON output in production (machine-parseable)
 *  - Pretty-printed colour output in development
 *  - Request-scoped child loggers via withContext()
 *  - Explicit scrubbing of sensitive field names
 */

import winston from 'winston';
import { config } from '../config';

// ── Sensitive field names that must never appear in logs ──────────────────────
const SENSITIVE_FIELDS = new Set([
  'password',
  'db_password',
  'secret',
  'token',
  'authorization',
  'access_token',
  'refresh_token',
  'aws_secret_access_key',
  'aws_session_token',
  'jwt_secret',
  'private_key',
  'api_key',
]);

/**
 * Recursively redact any key whose lower-cased name is in SENSITIVE_FIELDS.
 */
function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = SENSITIVE_FIELDS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v);
  }
  return result;
}

// ── Formats ───────────────────────────────────────────────────────────────────

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Redact the entire log entry
    const redacted = redact(info) as winston.Logform.TransformableInfo;
    Object.assign(info, redacted);
    return info;
  })(),
  winston.format.json(),
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n' + JSON.stringify(redact(meta), null, 2)
      : '';
    return `${String(timestamp)} [${level}] ${String(message)}${metaStr}`;
  }),
);

// ── Logger instance ───────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: config.server.logLevel,
  format: config.isProduction ? jsonFormat : prettyFormat,
  transports: [new winston.transports.Console()],
  // Prevent winston from crashing the process on transport errors
  exitOnError: false,
});

// ── Request-scoped child logger ───────────────────────────────────────────────

export type LogContext = Record<string, unknown>;

/**
 * Returns a child logger pre-populated with the given context fields.
 * Use this inside route handlers to attach a request ID or other metadata.
 */
export function withContext(context: LogContext): winston.Logger {
  return logger.child(context);
}
