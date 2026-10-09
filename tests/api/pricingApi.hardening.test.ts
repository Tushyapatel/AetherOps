import request from 'supertest';
import { createApp } from '../../src/app';
import { getPool } from '../../src/database';
import * as projectService from '../../src/api/v1/projects/project.service';

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

describe('Pricing Compare API - Hardening Demo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(projectService, 'getProject').mockResolvedValue({ id: '123', name: 'Test' } as any);
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.end();
  });

  it('AWS Demo fallback: correctly handles fallback to demo pricing', async () => {
    const res = await request(app)
      .post('/api/v1/projects/123/pricing/compare')
      .set('Cookie', 'atherops_token=valid')
      .send({ category: 'COMPUTE', region: 'INDIA', workload: { cpu: 1, memoryGb: 2, hoursPerMonth: 100 } });

    expect(res.status).toBe(200);
    const aws = res.body.data.providers.find((p: any) => p.provider === 'AWS');
    expect(aws.status).toBe('CALCULATED');
    expect(aws.source).toBe('DEMO_REFERENCE_PRICING');
  });

  it('Azure Demo fallback: correctly handles fallback to demo pricing', async () => {
    const res = await request(app)
      .post('/api/v1/projects/123/pricing/compare')
      .set('Cookie', 'atherops_token=valid')
      .send({ category: 'COMPUTE', region: 'INDIA', workload: { cpu: 2, memoryGb: 4, hoursPerMonth: 100 } });

    expect(res.status).toBe(200);
    const azure = res.body.data.providers.find((p: any) => p.provider === 'AZURE');
    expect(azure.status).toBe('CALCULATED');
    expect(azure.source).toBe('DEMO_REFERENCE_PRICING');
  });

  it('GCP Demo fallback: correctly handles fallback to demo pricing', async () => {
    const res = await request(app)
      .post('/api/v1/projects/123/pricing/compare')
      .set('Cookie', 'atherops_token=valid')
      .send({ category: 'COMPUTE', region: 'INDIA', workload: { cpu: 3, memoryGb: 4, hoursPerMonth: 100 } });

    expect(res.status).toBe(200);
    const gcp = res.body.data.providers.find((p: any) => p.provider === 'GCP');
    expect(gcp.status).toBe('CALCULATED');
    expect(gcp.source).toBe('DEMO_REFERENCE_PRICING');
  });
});
