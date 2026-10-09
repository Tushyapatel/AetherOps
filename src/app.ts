/**
 * AtherOps Backend – Express Application Factory
 *
 * createApp() constructs and configures the Express application.
 * It is kept separate from server.ts so the app can be imported in tests
 * without binding a real network port.
 *
 * Middleware order matters – do not reorder without understanding the
 * Express middleware chain semantics.
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLoggerMiddleware } from './middleware/httpLogger';
import { notFoundMiddleware } from './middleware/notFound';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { v1Router } from './api/v1';

export function createApp(): Application {
  const app = express();

  // ── Trust proxy ─────────────────────────────────────────────────────────────
  // Required for accurate IP logging and rate-limiting when behind a reverse
  // proxy (nginx, AWS ALB, etc.).
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // ── Security headers (helmet) ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction,
      crossOriginEmbedderPolicy: config.isProduction,
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.cors.origins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
      maxAge: 86400, // pre-flight cache: 24 hours
    }),
  );

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
        },
      },
    }),
  );

  // ── Request size limits ───────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Cookie parser ─────────────────────────────────────────────────────────────
  // Must come before routes that read cookies.
  app.use(cookieParser());

  // ── Request ID ────────────────────────────────────────────────────────────────

  app.use(requestIdMiddleware);

  // ── HTTP request logging ──────────────────────────────────────────────────────
  app.use(httpLoggerMiddleware);

  // ── API routes ─────────────────────────────────────────────────────────────────
  app.use(config.api.fullPrefix, v1Router);

  // ── 404 handler (must come after all routes) ──────────────────────────────────
  app.use(notFoundMiddleware);

  // ── Centralised error handler (must be last, 4 args) ─────────────────────────
  app.use(errorHandlerMiddleware);

  return app;
}
