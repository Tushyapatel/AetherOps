/**
 * AtherOps – Test: AWS Connection Endpoint
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';

// ── Mock AWS STS ──────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/aws/aws.sts', () => ({
  verifyAwsConnection: jest.fn(),
}));

// ── Mock Database ─────────────────────────────────────────────────────────────
jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy', latencyMs: 1, serverVersion: 'PostgreSQL 18', error: null }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn().mockReturnValue({ query: jest.fn() }),
  query: jest.fn(),
  withClient: jest.fn(),
}));

// ── Mock Auth Repository ──────────────────────────────────────────────────────
jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserById: jest.fn(),
}));

// ── Mock Cloud Account Repository ─────────────────────────────────────────────
jest.mock('../../src/api/v1/cloud-accounts/cloudAccount.repository', () => ({
  findCloudAccountById: jest.fn(),
}));

import { findUserById } from '../../src/api/v1/auth/auth.repository';
import { findCloudAccountById } from '../../src/api/v1/cloud-accounts/cloudAccount.repository';
import { verifyAwsConnection } from '../../src/infrastructure/aws/aws.sts';
import { getPool } from '../../src/database';

const mockFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockFindCloudAccountById = findCloudAccountById as jest.MockedFunction<typeof findCloudAccountById>;
const mockVerifyAwsConnection = verifyAwsConnection as jest.MockedFunction<typeof verifyAwsConnection>;
const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MOCK_USER_ID = 1;
const MOCK_PROJECT_ID = '10';
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-at-least-32-characters-long!!';

const MOCK_SAFE_USER = {
  id: MOCK_USER_ID,
  email: 'test@example.com',
  role: 'viewer' as const,
  status: 'ACTIVE' as const,
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const MOCK_CLOUD_ACCOUNT = {
  id: 50,
  user_id: MOCK_USER_ID,
  project_id: MOCK_PROJECT_ID,
  provider: 'AWS',
  account_id: '123456789012',
  account_name: 'Test AWS',
  environment: 'production',
  region: 'us-east-1',
  mode: 'DEMO',
  description: 'Desc',
  role_arn: 'arn:aws:iam::123456789012:role/AtherOpsRole',
  external_id: 'mock-uuid-1234',
  created_at: new Date(),
  last_scanned_at: null,
};

function generateAuthCookie(userId: number = MOCK_USER_ID) {
  const token = jwt.sign({ sub: String(userId), email: 'test@example.com', role: 'viewer' as const,
  status: 'ACTIVE', }, JWT_SECRET, {
    issuer: 'atherops',
    audience: 'atherops-api',
  });
  return `atherops_token=${token}`;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AWS Connection Endpoint', () => {
  const app = createApp();
  const validCookie = generateAuthCookie(MOCK_USER_ID);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);
  });

  describe('POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/connection-test', () => {
    
    it('returns 401 if unauthenticated', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`);
      expect(res.status).toBe(401);
    });

    it('returns 404 if cloud account is not found or owned by user', async () => {
      mockFindCloudAccountById.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/999/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });

    it('returns 400 if role_arn is missing', async () => {
      mockFindCloudAccountById.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, role_arn: null });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Role ARN is not configured/);
    });

    it('returns 400 if role_arn is structurally invalid', async () => {
      mockFindCloudAccountById.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, role_arn: 'invalid-arn' });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/invalid/);
    });

    it('returns 400 if role_arn account ID does not match cloud account ID', async () => {
      mockFindCloudAccountById.mockResolvedValue({ 
        ...MOCK_CLOUD_ACCOUNT, 
        role_arn: 'arn:aws:iam::999999999999:role/AtherOpsRole' 
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not match/);
    });

    it('returns successful connection details when AWS verifies and trust policy is secure', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockVerifyAwsConnection.mockResolvedValue({
        connected: true,
        awsAccountId: '123456789012',
        roleVerified: true,
        identityVerified: true,
        trustPolicyVerified: true,
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(true);
      expect(res.body.data.trust_policy_verified).toBe(true);
      expect(mockVerifyAwsConnection).toHaveBeenCalledWith(
        'arn:aws:iam::123456789012:role/AtherOpsRole',
        'mock-uuid-1234',
        '123456789012'
      );
    });

    it('returns connected=false and trust_policy_verified=false when negative test succeeds', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockVerifyAwsConnection.mockResolvedValue({
        connected: false,
        awsAccountId: '123456789012',
        roleVerified: true,
        identityVerified: true,
        trustPolicyVerified: false,
        error: 'Insecure AWS Trust Policy',
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(false);
      expect(res.body.data.trust_policy_verified).toBe(false);
      expect(res.body.data.error).toMatch(/Insecure AWS Trust Policy/);
    });

    it('returns 200 with connected=false and safe error when AWS fails', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockVerifyAwsConnection.mockResolvedValue({
        connected: false,
        awsAccountId: null,
        roleVerified: false,
        identityVerified: false,
        trustPolicyVerified: false,
        error: 'Access Denied: The role trust policy may not be configured correctly, or the External ID does not match.',
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/connection-test`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.connected).toBe(false);
      expect(res.body.data.error).toMatch(/Access Denied/);
    });
  });
});
