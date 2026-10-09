/**
 * AtherOps Backend – Auth Routes
 *
 * Mounts under /api/v1/auth (applied in the v1 router).
 *
 * Rate limiting: auth endpoints use a tighter limit than the global
 * rate limiter to slow down brute-force attacks.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../../config';
import { registerController, loginController, logoutController, meController } from './auth.controller';
import { requireAuth } from './auth.middleware';

const authRouter = Router();

// ── Auth-specific rate limiter ────────────────────────────────────────────────
// Tighter than the global limiter: 20 requests per 15 minutes per IP.
// Applied only to login and register to block brute-force without
// affecting other auth-adjacent routes like /me.

const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again later.',
    },
  },
  skipSuccessfulRequests: false,
  // Disable rate limiting in test environment to keep tests deterministic
  skip: () => config.isTest,
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** POST /auth/register – create a new account */
authRouter.post('/register', authLimiter, registerController);

/** POST /auth/login – authenticate with email + password */
authRouter.post('/login', authLimiter, loginController);

/** POST /auth/logout – clear the auth cookie */
authRouter.post('/logout', logoutController);

/** GET /auth/me – return current authenticated user */
authRouter.get('/me', requireAuth, meController);

export { authRouter };
