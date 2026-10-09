/**
 * AtherOps Backend – Auth Controller
 *
 * Handles HTTP request/response concerns for authentication:
 *  - Validates input via Zod schemas
 *  - Delegates business logic to auth.service
 *  - Sets/clears the JWT cookie
 *  - Returns consistent API responses
 *  - Never exposes password_hash or JWT value in response body
 *
 * Cookie settings:
 *  - httpOnly: true  → inaccessible to JavaScript (XSS protection)
 *  - sameSite: strict → CSRF protection
 *  - secure: true in production → HTTPS only
 *  - maxAge: matches JWT expiry (15 minutes default)
 */

import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from './auth.validation';
import { registerUser, loginUser, signToken } from './auth.service';
import { config } from '../../../config';
import { UnauthorizedError } from '../../../errors';

// ── Cookie helper ─────────────────────────────────────────────────────────────

/** Parse "15m" → milliseconds for cookie maxAge */
function expiryToMs(expiresIn: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
  if (!match) return 15 * 60 * 1000; // default 15 minutes

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 60_000;
  return value * multiplier;
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: expiryToMs(config.jwt.expiresIn),
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 */
export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input);
    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const user = await loginUser(input);
    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 */
export function logoutController(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
}

/**
 * GET /api/v1/auth/me
 * Protected by requireAuth middleware — req.user is guaranteed to be present.
 */
export function meController(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        created_at: req.user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}
