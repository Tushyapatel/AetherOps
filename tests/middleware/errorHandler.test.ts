/**
 * AtherOps – Test: Error Handling
 *
 * Verifies that the centralised error handler produces consistent
 * JSON responses for common error scenarios.
 */

import request from 'supertest';
import { Router } from 'express';
import express from 'express';
import { requestIdMiddleware } from '../../src/middleware/requestId';
import { notFoundMiddleware } from '../../src/middleware/notFound';
import { errorHandlerMiddleware } from '../../src/middleware/errorHandler';
import {
  AppError,
  NotFoundError,
  ValidationError,
} from '../../src/errors';

/** Build a minimal app with injected routes for testing error paths */
function buildTestApp(routerFn?: (router: Router) => void) {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);

  const router = Router();
  if (routerFn) routerFn(router);
  app.use(router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('Error Handling Middleware', () => {
  describe('404 – unknown route', () => {
    const app = buildTestApp();

    it('returns HTTP 404', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns a structured error body', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeTruthy();
      expect(res.body.error.timestamp).toBeTruthy();
    });
  });

  describe('Custom AppError', () => {
    const app = buildTestApp((r) => {
      r.get('/boom', (_req, _res, next) => {
        next(new AppError('Something went wrong', 418, 'TEAPOT'));
      });
    });

    it('returns the specified status code', async () => {
      const res = await request(app).get('/boom');
      expect(res.status).toBe(418);
    });

    it('returns the specified error code', async () => {
      const res = await request(app).get('/boom');
      expect(res.body.error.code).toBe('TEAPOT');
    });
  });

  describe('ValidationError', () => {
    const app = buildTestApp((r) => {
      r.get('/validate', (_req, _res, next) => {
        next(new ValidationError('Invalid input', { field: ['Required'] }));
      });
    });

    it('returns HTTP 400', async () => {
      const res = await request(app).get('/validate');
      expect(res.status).toBe(400);
    });

    it('includes field-level details', async () => {
      const res = await request(app).get('/validate');
      expect(res.body.error.details).toEqual({ field: ['Required'] });
    });
  });

  describe('NotFoundError', () => {
    const app = buildTestApp((r) => {
      r.get('/missing', (_req, _res, next) => {
        next(new NotFoundError('Widget'));
      });
    });

    it('returns HTTP 404 with NOT_FOUND code', async () => {
      const res = await request(app).get('/missing');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Unhandled Error', () => {
    const app = buildTestApp((r) => {
      r.get('/crash', () => {
        throw new Error('Unexpected crash');
      });
    });

    it('returns HTTP 500', async () => {
      const res = await request(app).get('/crash');
      expect(res.status).toBe(500);
    });

    it('returns INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/crash');
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('does not expose raw stack traces', async () => {
      const res = await request(app).get('/crash');
      expect(JSON.stringify(res.body)).not.toContain('at Object.<anonymous>');
    });
  });
});
