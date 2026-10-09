/**
 * AtherOps Backend – Centralised Error Types
 *
 * All application errors extend AppError.
 * The error handler middleware converts these into consistent HTTP responses.
 */

// ── Base application error ────────────────────────────────────────────────────

export class AppError extends Error {
  /** HTTP status code to return to the client */
  public readonly statusCode: number;
  /** Machine-readable error code for clients to branch on */
  public readonly code: string;
  /** Whether this error is expected/operational (true) vs a bug (false) */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Specific error subclasses ─────────────────────────────────────────────────

/** 400 – client sent malformed or logically invalid data */
export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/** 404 – requested resource does not exist */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/** 409 – request conflicts with current state */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** 401 – unauthenticated request */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 – authenticated but not permitted */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 422 – semantically invalid but syntactically correct request */
export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(message, 422, 'UNPROCESSABLE_ENTITY');
  }
}

/** 500 – unexpected server-side failure (marked non-operational) */
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

/** 503 – downstream dependency (e.g. database) is unavailable */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
  }
}
