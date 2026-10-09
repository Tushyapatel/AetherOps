import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy', latencyMs: 1, serverVersion: 'PostgreSQL 18', error: null }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 1, status: 'COMPLETED' }] })
  })),
  query: jest.fn(),
  withClient: jest.fn(),
}));

jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserById: jest.fn().mockResolvedValue({
    id: 1,
    email: 'test@example.com',
    role: 'viewer' as const,
  status: 'ACTIVE',
    created_at: new Date('2026-01-01T00:00:00Z'),
  }),
}));

jest.mock('../../src/modules/security/rules/rule.service', () => ({
  runSecurityEvaluation: jest.fn().mockResolvedValue({
    evaluatedRules: ['SG-001', 'S3-001'],
    findingsCreated: 2,
    findingsUpdated: 0,
    findingsResolved: 0
  })
}));

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-at-least-32-characters-long!!';

function generateAuthCookie(userId: number = 1) {
  const token = jwt.sign({ sub: String(userId), email: 'test@example.com', role: 'viewer' as const,
  status: 'ACTIVE', }, JWT_SECRET, {
    issuer: 'atherops',
    audience: 'atherops-api',
  });
  return `atherops_token=${token}`;
}

describe('Security Evaluation Endpoints', () => {
  const app = createApp();
  const validCookie = generateAuthCookie(1);

  describe('POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/analysis-runs/:analysisRunId/evaluate', () => {
    it('runs security evaluation and returns summary', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/10/cloud-accounts/50/analysis-runs/100/evaluate`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Security evaluation completed');
      expect(res.body.evaluatedRules).toBe(2);
      expect(res.body.findingsCreated).toBe(2);
      expect(res.body.findingsUpdated).toBe(0);
      expect(res.body.findingsResolved).toBe(0);
    });
  });
});
