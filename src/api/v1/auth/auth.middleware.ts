/**
 * AtherOps Backend – Auth Middleware: requireAuth
 *
 * Protects routes by validating the JWT stored in the HTTP-only cookie.
 *
 * On success: attaches req.user (SafeUser) and calls next().
 * On failure: throws UnauthorizedError which the centralised error handler
 *             converts to a 401 JSON response.
 *
 * Never logs the token value itself.
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../errors';
import { verifyToken } from './auth.service';
import { findUserById } from './auth.repository';
import { config } from '../../../config';
import { logger } from '../../../logger';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // ── Extract token from HTTP-only cookie ──────────────────────────────────
    const token = req.cookies?.[config.cookie.name] as string | undefined;

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    // ── Verify JWT ───────────────────────────────────────────────────────────
    const payload = verifyToken(token);
    const userId = parseInt(payload.sub, 10);

    if (isNaN(userId)) {
      throw new UnauthorizedError('Invalid token');
    }

    // ── Load current user from DB ────────────────────────────────────────────
    // This ensures the user still exists and that their role is up-to-date.
    const user = await findUserById(userId);

    if (!user) {
      logger.warn('Auth token valid but user not found', { userId });
      throw new UnauthorizedError('Authentication required');
    }

    if (user.status === 'BLOCKED') {
      logger.warn('Auth blocked user attempted access', { userId });
      throw new UnauthorizedError('Account is blocked');
    }

    // ── Attach to request ────────────────────────────────────────────────────
    req.user = user;
    next();
  } catch (err) {
    // Re-throw UnauthorizedError as-is; convert JWT errors to generic 401
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }

    // JsonWebTokenError, TokenExpiredError, NotBeforeError
    logger.warn('JWT verification failed', {
      error: err instanceof Error ? err.constructor.name : 'Unknown',
    });
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // First ensure they are authenticated
  await requireAuth(req, res, (err?: any) => {
    if (err) return next(err);
    
    // Now verify the role
    if (!req.user || req.user.role !== 'PLATFORM_ADMIN') {
      logger.warn('Non-admin attempted to access admin route', { userId: req.user?.id });
      return next(new UnauthorizedError('Admin access required'));
    }
    
    next();
  });
}
