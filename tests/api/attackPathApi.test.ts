import request from 'supertest';

// Mocks
jest.mock('../../src/database', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mPool = {
    connect: jest.fn().mockResolvedValue(mClient),
    query: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { getPool: jest.fn(() => mPool), checkDbHealth: jest.fn() };
});
jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn().mockResolvedValue({ id: 1, email: 'test@example.com' }),
}));

import { createApp } from '../../src/app';
import { getPool } from '../../src/database';
import * as jwt from 'jsonwebtoken';
import { config } from '../../src/config';

describe('Attack Path Correlation API', () => {
  const appInstance = createApp();
  let token: string;
  let mPool: any;
  let mClient: any;

  beforeEach(() => {
    token = jwt.sign(
      { sub: '1', email: 'test@example.com', role: 'admin' as const,
  status: 'ACTIVE', },
      config.jwt.secret,
      { expiresIn: '1h', issuer: 'atherops', audience: 'atherops-api' }
    );
    mPool = getPool();
    mClient = { query: jest.fn(), release: jest.fn() };
    mPool.connect.mockResolvedValue(mClient);
    jest.clearAllMocks();
  });

  it('should analyze attack paths and return success', async () => {
    // 1. Verify ownership mock
    mPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // checkAnalysisRunOwnership

    // 2. Load data mocks
    mPool.query.mockResolvedValueOnce({ rows: [{ id: 1, resource_id: 'r1', resource_type: 'RES' }, { id: 2, resource_id: 'r2', resource_type: 'RES' }] }); // resources
    mPool.query.mockResolvedValueOnce({ rows: [{ resource_a_id: 1, resource_b_id: 2, relation_type: 'ATTACHED_TO' }] }); // relationships
    mPool.query.mockResolvedValueOnce({ rows: [
      { resource_id: 1, rule_id: 'R-1', severity: 'HIGH' },
      { resource_id: 2, rule_id: 'R-2', severity: 'HIGH' }
    ] }); // findings

    // 3. Save attack paths mocks
    mClient.query.mockResolvedValueOnce({}); // BEGIN
    mClient.query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT path 1 (returns 1 row inserted)
    mClient.query.mockResolvedValueOnce({}); // COMMIT

      const res = await request(appInstance)
      .post(`/api/v1/projects/1/cloud-accounts/1/analysis-runs/1/attack-paths/analyze`)
        .set('Cookie', [`atherops_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pathsDiscovered).toBe(1);

    // Verify ownership query included userId
    expect(mPool.query.mock.calls[0][1]).toContain(1); // userId=1
  });

  it('should prevent analyzing paths for unowned project', async () => {
    // Return empty for ownership check
    mPool.query.mockResolvedValueOnce({ rows: [] }); 

      const res = await request(appInstance)
      .post(`/api/v1/projects/999/cloud-accounts/1/analysis-runs/1/attack-paths/analyze`)
        .set('Cookie', [`atherops_token=${token}`]);

    expect(res.status).toBe(404);
  });

  it('should reject unauthenticated requests', async () => {
      const res = await request(appInstance)
      .post(`/api/v1/projects/1/cloud-accounts/1/analysis-runs/1/attack-paths/analyze`);

    expect(res.status).toBe(401);
  });

  describe('Concurrency & Idempotency', () => {
    it('should handle concurrent analysis runs for the same run ID without throwing', async () => {
      // Return true for ownership check for both
      mPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Mock everything else safely so it doesn't fail
      mClient.query.mockResolvedValue({ rowCount: 1 });

      const req1 = request(appInstance)
        .post(`/api/v1/projects/1/cloud-accounts/1/analysis-runs/1/attack-paths/analyze`)
          .set('Cookie', [`atherops_token=${token}`]);
        
      const req2 = request(appInstance)
        .post(`/api/v1/projects/1/cloud-accounts/1/analysis-runs/1/attack-paths/analyze`)
          .set('Cookie', [`atherops_token=${token}`]);

      const [res1, res2] = await Promise.all([req1, req2]);
      
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });
});
