/**
 * AtherOps Backend – Middleware: Centralised Error Handler
 *
 * Must be registered AFTER all routes as a 4-argument Express middleware.
 *
 * Behaviour:
 *  - AppError subclasses → return their status code + structured JSON
 *  - Zod validation errors → 400 with field-level details
 *  - Unknown errors → 500 with a generic message in production
 *  - Full stack traces only appear in server-side logs, never in responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors';
import { logger } from '../logger';
import { config } from '../config';

/** Canonical error response shape returned to all clients */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    timestamp: string;
  };
}

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Zod validation errors ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const validationError = new ValidationError(
      'Request validation failed',
      err.flatten().fieldErrors,
    );

    logger.warn('Request validation failed', {
      requestId: req.requestId,
      path: req.path,
      errors: err.flatten().fieldErrors,
    });

    res.status(400).json(buildResponse(validationError, req.requestId));
    return;
  }

  // ── Known operational errors ───────────────────────────────────────────────
  if (err instanceof AppError) {
    const logFn = err.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);

    logFn('Application error', {
      requestId: req.requestId,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      // Stack in server logs only
      ...(config.isDevelopment && { stack: err.stack }),
    });

    res.status(err.statusCode).json(buildResponse(err, req.requestId));
    return;
  }

  // ── Unknown / unexpected errors ────────────────────────────────────────────
  logger.error('Unhandled error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
  });

  const isProduction = config.isProduction;
  const responseMessage = isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: responseMessage,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  } satisfies ErrorResponse);
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function buildResponse(err: AppError, requestId: string): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  if (err instanceof ValidationError && err.details !== undefined) {
    response.error.details = err.details;
  }

  return response;
}
