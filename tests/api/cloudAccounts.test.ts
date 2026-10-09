/**
 * AtherOps – Test: Cloud Account Endpoints
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

// ── Mock the database ─────────────────────────────────────────────────────────
jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy', latencyMs: 1, serverVersion: 'PostgreSQL 18', error: null }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
  query: jest.fn(),
  withClient: jest.fn(),
}));

// ── Mock auth repository ──────────────────────────────────────────────────────
jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserById: jest.fn(),
}));

// ── Mock cloud account repository ─────────────────────────────────────────────
jest.mock('../../src/api/v1/cloud-accounts/cloudAccount.repository', () => ({
  findCloudAccountsByProject: jest.fn(),
  findCloudAccountById: jest.fn(),
  checkProjectOwnership: jest.fn(),
  checkAccountInProject: jest.fn(),
  createCloudAccount: jest.fn(),
  updateCloudAccount: jest.fn(),
  disconnectCloudAccount: jest.fn(),
}));

import { findUserById } from '../../src/api/v1/auth/auth.repository';
import {
  findCloudAccountsByProject,
  findCloudAccountById,
  checkProjectOwnership,
  checkAccountInProject,
  createCloudAccount,
  updateCloudAccount,
  disconnectCloudAccount,
} from '../../src/api/v1/cloud-accounts/cloudAccount.repository';

const mockFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockFindCloudAccountsByProject = findCloudAccountsByProject as jest.MockedFunction<typeof findCloudAccountsByProject>;
const mockFindCloudAccountById = findCloudAccountById as jest.MockedFunction<typeof findCloudAccountById>;
const mockCheckProjectOwnership = checkProjectOwnership as jest.MockedFunction<typeof checkProjectOwnership>;
const mockCheckAccountInProject = checkAccountInProject as jest.MockedFunction<typeof checkAccountInProject>;
const mockCreateCloudAccount = createCloudAccount as jest.MockedFunction<typeof createCloudAccount>;
const mockUpdateCloudAccount = updateCloudAccount as jest.MockedFunction<typeof updateCloudAccount>;
const mockDisconnectCloudAccount = disconnectCloudAccount as jest.MockedFunction<typeof disconnectCloudAccount>;

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
  role_arn: null,
  external_id: 'mock-external-id',
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

describe('Cloud Account Endpoints', () => {
  const app = createApp();
  const validCookie = generateAuthCookie(MOCK_USER_ID);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);
  });

  describe('POST /api/v1/projects/:projectId/cloud-accounts', () => {
    it('creates a cloud account if user owns project', async () => {
      mockCheckProjectOwnership.mockResolvedValue(true);
      mockCheckAccountInProject.mockResolvedValue(false);
      mockCreateCloudAccount.mockResolvedValue(MOCK_CLOUD_ACCOUNT);

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie])
        .send({
          provider: 'AWS',
          account_id: '123456789012',
          account_name: 'Test AWS',
          region: 'us-east-1'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockCreateCloudAccount).toHaveBeenCalledWith(MOCK_USER_ID, MOCK_PROJECT_ID, expect.any(Object));
    });

    it('returns 404 if user does not own project', async () => {
      mockCheckProjectOwnership.mockResolvedValue(false);

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie])
        .send({
          provider: 'AWS',
          account_id: '123456789012',
          account_name: 'Test AWS',
          region: 'us-east-1'
        });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid account_id format', async () => {
      mockCheckProjectOwnership.mockResolvedValue(true);

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie])
        .send({
          provider: 'AWS',
          account_id: '12345abc', // invalid
          account_name: 'Test AWS',
          region: 'us-east-1'
        });

      expect(res.status).toBe(400);
    });
    
    it('returns 409 if account already exists in project', async () => {
      mockCheckProjectOwnership.mockResolvedValue(true);
      mockCheckAccountInProject.mockResolvedValue(true); // Exists!

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie])
        .send({
          provider: 'AWS',
          account_id: '123456789012',
          account_name: 'Test AWS',
          region: 'us-east-1'
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/projects/:projectId/cloud-accounts', () => {
    it('lists accounts if user owns project', async () => {
      mockCheckProjectOwnership.mockResolvedValue(true);
      mockFindCloudAccountsByProject.mockResolvedValue([MOCK_CLOUD_ACCOUNT]);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 404 if user does not own project', async () => {
      mockCheckProjectOwnership.mockResolvedValue(false);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId', () => {
    it('returns the account if valid ownership chain', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(mockFindCloudAccountById).toHaveBeenCalledWith(50, MOCK_PROJECT_ID, MOCK_USER_ID);
    });

    it('returns 404 if ownership chain is invalid', async () => {
      mockFindCloudAccountById.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/setup', () => {
    let originalArn: any;
    beforeAll(() => {
      originalArn = config.cloudApis.atheropsServicePrincipalArn;
    });
    afterAll(() => {
      (config.cloudApis as any).atheropsServicePrincipalArn = originalArn;
    });

    it('returns setup details including external_id if valid ownership chain', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/setup`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.externalId).toBe('mock-external-id');
      expect(mockFindCloudAccountById).toHaveBeenCalledWith(50, MOCK_PROJECT_ID, MOCK_USER_ID);
    });

    it('returns setup endpoint nulls servicePrincipalArn when not configured', async () => {
      (config.cloudApis as any).atheropsServicePrincipalArn = undefined;
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      const res = await request(app).get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/setup`).set('Cookie', [validCookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.servicePrincipalArn).toBeNull();
    });

    it('returns servicePrincipalArn when configured', async () => {
      (config.cloudApis as any).atheropsServicePrincipalArn = 'arn:aws:iam::111:role/AtherOps';
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      const res = await request(app).get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/setup`).set('Cookie', [validCookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.servicePrincipalArn).toBe('arn:aws:iam::111:role/AtherOps');
    });

    it('returns 404 if ownership chain is invalid (customer A cannot retrieve customer B setup)', async () => {
      mockFindCloudAccountById.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/setup`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId', () => {
    it('updates account if valid ownership chain', async () => {
      mockUpdateCloudAccount.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, account_name: 'New Name' });

      const res = await request(app)
        .patch(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie])
        .send({ account_name: 'New Name' });

      expect(res.status).toBe(200);
      expect(mockUpdateCloudAccount).toHaveBeenCalledWith(50, MOCK_PROJECT_ID, MOCK_USER_ID, expect.any(Object));
    });

    it('returns 404 if unauthorized or nonexistent', async () => {
      mockUpdateCloudAccount.mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie])
        .send({ account_name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId', () => {
    it('disconnects account if valid ownership chain', async () => {
      mockDisconnectCloudAccount.mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(mockDisconnectCloudAccount).toHaveBeenCalledWith(50, MOCK_PROJECT_ID, MOCK_USER_ID);
    });

    it('returns 404 if unauthorized or nonexistent', async () => {
      mockDisconnectCloudAccount.mockResolvedValue(false);

      const res = await request(app)
        .delete(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
  });
});
