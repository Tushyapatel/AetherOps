import request from 'supertest';
import { createApp } from '../../src/app';
import { getPool } from '../../src/database';
import * as projectService from '../../src/api/v1/projects/project.service';
import * as dashboardRepo from '../../src/api/v1/dashboard/dashboard.repository';

jest.mock('../../src/api/v1/auth/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.cookie?.includes('atherops_token=valid')) {
      req.user = { id: 1, email: 'test@example.com', role: 'viewer' as const, status: 'ACTIVE' };
      next();
    } else {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
  },
  requireAdmin: (req: any, res: any, next: any) => { next(); }
}));

const app = createApp();

describe('Report API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe('GET /api/v1/projects/:projectId/reports/security-assessment', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/projects/123/reports/security-assessment');
      expect(res.status).toBe(401);
    });

    it('rejects wrong project ownership', async () => {
      jest.spyOn(projectService, 'getProject').mockRejectedValue({ status: 404, message: 'Not found' });
      const res = await request(app)
        .get('/api/v1/projects/123/reports/security-assessment')
        .set('Cookie', 'atherops_token=valid');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns report data successfully', async () => {
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: '123', name: 'Test' } as any);
      jest.spyOn(dashboardRepo, 'getProjectFindings').mockResolvedValue([{
        id: '1', title: 'Test Finding', severity: 'HIGH', status: 'OPEN', cloud_account_name: 'test-acc'
      }] as any);
      jest.spyOn(dashboardRepo, 'getProjectResources').mockResolvedValue([
        { id: '1', name: 'res', type: 'EC2', region: 'us-east-1', cloud_account_id: 'c1' }
      ] as any);
      jest.spyOn(dashboardRepo, 'getProjectAttackPaths').mockResolvedValue([] as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskScores').mockResolvedValue({ overall_score: 80 } as any);
      jest.spyOn(dashboardRepo, 'getProjectCosts').mockResolvedValue([] as any);

      const res = await request(app)
        .get('/api/v1/projects/123/reports/security-assessment')
        .set('Cookie', 'atherops_token=valid');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metadata.projectName).toBe('Test');
      expect(res.body.data.summary.overallRiskScore).toBe(80);
      expect(res.body.data.summary.severityDistribution.HIGH).toBe(1);
    });
  });

  describe('GET /api/v1/projects/:projectId/reports/security-assessment/pdf', () => {
    it('returns a PDF file', async () => {
      jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: '123', name: 'Test' } as any);
      jest.spyOn(dashboardRepo, 'getProjectFindings').mockResolvedValue([] as any);
      jest.spyOn(dashboardRepo, 'getProjectResources').mockResolvedValue([] as any);
      jest.spyOn(dashboardRepo, 'getProjectAttackPaths').mockResolvedValue([] as any);
      jest.spyOn(dashboardRepo, 'getProjectRiskScores').mockResolvedValue(null as any);
      jest.spyOn(dashboardRepo, 'getProjectCosts').mockResolvedValue([] as any);

      const res = await request(app)
        .get('/api/v1/projects/123/reports/security-assessment/pdf')
        .set('Cookie', 'atherops_token=valid');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });
});
