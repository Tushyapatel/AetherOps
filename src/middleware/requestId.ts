/**
 * AtherOps Backend – Middleware: Request ID
 *
 * Attaches a unique request ID to every incoming request.
 * The ID is sourced from the X-Request-ID header (if provided by a proxy)
 * or generated as a UUIDv4.
 *
 * Downstream handlers and the error handler can access req.requestId for
 * structured, correlated logging.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.length > 0
    ? incomingId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
