/**
 * AtherOps Backend – Middleware: HTTP Request Logger
 *
 * Logs each request on completion.  Intentionally avoids logging:
 *  - Authorization headers
 *  - Cookie values
 *  - Request bodies (may contain credentials)
 *
 * Log level is 'http' so it can be suppressed in tests or production
 * by raising the configured log level.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;

    logger.http(`${req.method} ${req.path}`, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: parseFloat(durationMs.toFixed(2)),
      contentLength: res.getHeader('content-length') ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      // IP may be proxied – prefer X-Forwarded-For if trusted
      ip: req.ip,
    });
  });

  next();
}
