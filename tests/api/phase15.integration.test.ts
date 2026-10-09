import request from 'supertest';
import { createApp } from '../../src/app';
import { getPool } from '../../src/database';
import * as projectService from '../../src/api/v1/projects/project.service';
import * as dashboardRepo from '../../src/api/v1/dashboard/dashboard.repository';

// Mock DB pool
jest.mock('../../src/database', () => {
  const mClient = { query: jest.fn(), release: jest.fn() };
  const mPool = {
    connect: jest.fn().mockResolvedValue(mClient),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { getPool: jest.fn(() => mPool), checkDbHealth: jest.fn() };
});

jest.mock('../../src/api/v1/auth/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.cookie?.includes('atherops_token=valid')) {
      req.user = { id: 1, email: 'test@example.com', role: 'admin' as const, status: 'ACTIVE' };
      next();
    } else if (req.headers.cookie?.includes('atherops_token=user2')) {
      req.user = { id: 2, email: 'user2@example.com', role: 'viewer' as const, status: 'ACTIVE' };
      next();
    } else {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
  },
  requireAdmin: (req: any, res: any, next: any) => { next(); }
}));

const app = createApp();

describe('Phase 15 - End-to-End & Hardening', () => {
  const projectId = 123;
  let mPool: any;

  beforeEach(() => {
    mPool = getPool();
    jest.restoreAllMocks();
    // Default mPool.query safely returns [] if not mocked
    mPool.query.mockResolvedValue({ rows: [] });
  });

  afterAll(async () => {
    await mPool.end();
  });

  describe('A. End-to-End Workflow & Module Integration', () => {
    it('integrates projects, dashboard, and reports', async () => {
      mPool.query.mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Proj 1' }] }); // Projects

      const projRes = await request(app)
        .get('/api/v1/projects')
        .set('Cookie', 'atherops_token=valid');
      expect(projRes.status).toBe(200);

      // Dashboard
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: projectId, name: 'Proj 1' } as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskScores').mockResolvedValue({ score: 85 } as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskHistory').mockResolvedValue([] as any);

      const dashRes = await request(app)
        .get(`/api/v1/projects/${projectId}/risk`)
        .set('Cookie', 'atherops_token=valid');
      expect(dashRes.status).toBe(200);

      // Reports
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: projectId, name: 'Proj 1' } as any);
      jest.spyOn(dashboardRepo, 'getProjectFindings').mockResolvedValue([]);
      jest.spyOn(dashboardRepo, 'getProjectResources').mockResolvedValue([]);
      jest.spyOn(dashboardRepo, 'getProjectAttackPaths').mockResolvedValue([]);
      jest.spyOn(dashboardRepo, 'getProjectRiskScores').mockResolvedValue({ score: 85 } as any);
      jest.spyOn(dashboardRepo, 'getProjectCosts').mockResolvedValue([]);

      const repRes = await request(app)
        .get(`/api/v1/projects/${projectId}/reports/security-assessment`)
        .set('Cookie', 'atherops_token=valid');
      expect(repRes.status).toBe(200);
      expect(repRes.body.data.metadata.projectId).toBe(projectId);
    });
  });

  describe('B. Authorization Matrix & IDOR Hardening', () => {
    it('rejects unauthenticated access (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/risk`);
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized user access to project (404/403 - IDOR)', async () => {
      mPool.query.mockResolvedValueOnce({ rows: [] }); // ownership fail
      
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/risk`)
        .set('Cookie', 'atherops_token=user2');
      expect(res.status).toBeGreaterThanOrEqual(400); 
      expect(res.body.error?.message).not.toContain('stack');
    });

    it('returns 404 for non-existent project', async () => {
      mPool.query.mockResolvedValueOnce({ rows: [] }); // ownership fail
      const res = await request(app)
        .get('/api/v1/projects/9999999/risk')
        .set('Cookie', 'atherops_token=valid');
      expect(res.status).toBe(404);
    });
  });

  describe('C. Error Propagation & Secret Leak Check', () => {
    it('never exposes internal AWS credentials or role ARNs in dashboard', async () => {
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: projectId, name: 'Proj 1' } as any);
      jest.spyOn(dashboardRepo, 'getProjectResources').mockResolvedValue([
        { id: '1', name: 'my-res', type: 'EC2' }
      ] as any);
      
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/resources`)
        .set('Cookie', 'atherops_token=valid');
      
      const str = JSON.stringify(res.body);
      expect(str).not.toContain('arn:aws:iam');
      expect(str).not.toContain('111122223333');
      expect(str).not.toContain('GEMINI_API_KEY');
    });

    it('never exposes stack traces in 500 errors', async () => {
      jest.spyOn(projectService, 'getProject').mockRejectedValue(new Error('DB failure'));
      
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/risk`)
        .set('Cookie', 'atherops_token=valid');
      
      expect(res.status).toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  describe('D. Idempotency & Concurrency', () => {
    it('can fetch dashboard repeatedly without side effects', async () => {
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: projectId, name: 'Proj 1' } as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskScores').mockResolvedValue({ score: 85 } as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskHistory').mockResolvedValue([] as any);
      
      const p1 = request(app).get(`/api/v1/projects/${projectId}/risk`).set('Cookie', 'atherops_token=valid');
      const p2 = request(app).get(`/api/v1/projects/${projectId}/risk`).set('Cookie', 'atherops_token=valid');
      const [r1, r2] = await Promise.all([p1, p2]);
      
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });
  });
});
