/**
 * AtherOps Backend – Middleware: 404 Not Found Handler
 *
 * Catches any request that reaches this point without being handled by a route.
 * Passes a NotFoundError to the centralised error handler.
 */

import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors';

export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
}
