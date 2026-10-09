/**
 * AtherOps – Test: Health Endpoint
 *
 * Tests the GET /api/v1/health endpoint.
 * Uses supertest so no real server port is opened.
 *
 * Database behaviour is mocked so these tests pass without a live database.
 */

import request from 'supertest';
import { createApp } from '../../src/app';

// ── Mock the database module ─────────────────────────────────────────────────
// This keeps the test deterministic regardless of the local DB state.

jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn(),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
  query: jest.fn(),
  withClient: jest.fn(),
}));

import { checkDbHealth } from '../../src/database';

const mockCheckDbHealth = checkDbHealth as jest.MockedFunction<typeof checkDbHealth>;

// ── Test suite ────────────────────────────────────────────────────────────────

describe('GET /api/v1/health', () => {
  const app = createApp();

  describe('when database is healthy', () => {
    beforeEach(() => {
      mockCheckDbHealth.mockResolvedValue({
        status: 'healthy',
        latencyMs: 4,
        serverVersion: 'PostgreSQL 16.1',
        error: null,
      });
    });

    it('returns HTTP 200', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
    });

    it('returns success: true', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.success).toBe(true);
    });

    it('reports overall status as "healthy"', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.data.status).toBe('healthy');
    });

    it('includes database service details', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.data.services.database.status).toBe('healthy');
      expect(res.body.data.services.database.latencyMs).toBe(4);
      expect(res.body.data.services.database.serverVersion).toBe('PostgreSQL 16.1');
    });

    it('includes a timestamp', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(new Date(res.body.data.timestamp).toISOString()).toBeTruthy();
    });

    it('echoes X-Request-ID in response headers', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-ID', 'test-req-123');
      expect(res.headers['x-request-id']).toBe('test-req-123');
    });

    it('generates X-Request-ID when not provided', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('when database is unhealthy', () => {
    beforeEach(() => {
      mockCheckDbHealth.mockResolvedValue({
        status: 'unhealthy',
        latencyMs: 5001,
        serverVersion: null,
        error: 'Connection refused',
      });
    });

    it('returns HTTP 503', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(503);
    });

    it('returns success: false', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.success).toBe(false);
    });

    it('reports overall status as "degraded"', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.data.status).toBe('degraded');
    });

    it('surfaces database error message', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.data.services.database.error).toBe('Connection refused');
    });
  });
});
