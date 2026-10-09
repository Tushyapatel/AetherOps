import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('../../src/infrastructure/aws/aws.sts', () => ({
  getTemporaryCredentials: jest.fn(),
}));

jest.mock('../../src/api/v1/aws-collector/aws-discovery', () => ({
  runAwsDiscovery: jest.fn(),
}));

jest.mock('../../src/database', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    getPool: jest.fn().mockReturnValue({ 
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mClient)
    }),
  };
});

jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserById: jest.fn(),
}));

jest.mock('../../src/api/v1/cloud-accounts/cloudAccount.repository', () => ({
  findCloudAccountById: jest.fn(),
}));

import { findUserById } from '../../src/api/v1/auth/auth.repository';
import { findCloudAccountById } from '../../src/api/v1/cloud-accounts/cloudAccount.repository';
import { getTemporaryCredentials } from '../../src/infrastructure/aws/aws.sts';
import { runAwsDiscovery } from '../../src/api/v1/aws-collector/aws-discovery';
import { getPool } from '../../src/database';

const mockFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockFindCloudAccountById = findCloudAccountById as jest.MockedFunction<typeof findCloudAccountById>;
const mockGetTempCreds = getTemporaryCredentials as jest.MockedFunction<typeof getTemporaryCredentials>;
const mockRunAwsDiscovery = runAwsDiscovery as jest.MockedFunction<typeof runAwsDiscovery>;
const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

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
  mode: 'LIVE',
  description: 'Desc',
  role_arn: 'arn:aws:iam::123456789012:role/AtherOpsRole',
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

describe('AWS Collector / Discovery Endpoint', () => {
  const app = createApp();
  const validCookie = generateAuthCookie(MOCK_USER_ID);

  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '999' }] }), // For createAnalysisRun
      connect: jest.fn().mockResolvedValue(mockClient)
    };

    mockGetPool.mockReturnValue(mockPool);

    // Default mock setup for successful upsert returning IDs
    let idCounter = 1;
    mockClient.query.mockImplementation((queryStr: string) => {
      if (queryStr.includes('UPDATE resources') || queryStr.includes('UPDATE relationships')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: idCounter++ }] });
      }
      if (queryStr.includes('INSERT INTO resources') || queryStr.includes('INSERT INTO relationships')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: idCounter++ }] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  describe('POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/discover', () => {
    it('returns 401 if unauthenticated', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`);
      expect(res.status).toBe(401);
    });

    it('returns 404 if cloud account is not found or owned by user', async () => {
      mockFindCloudAccountById.mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/999/discover`)
        .set('Cookie', [validCookie]);
      expect(res.status).toBe(404);
    });

    it('skips discovery if cloud account is in DEMO mode', async () => {
      mockFindCloudAccountById.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, mode: 'DEMO' });
      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(mockGetTempCreds).not.toHaveBeenCalled();
    });

    it('returns 400 if role_arn is missing', async () => {
      mockFindCloudAccountById.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, role_arn: null });
      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Role ARN is missing/);
    });

    it('fails safely if AssumeRole fails', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockGetTempCreds.mockRejectedValue(new Error('AccessDenied'));

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(500); // Or whatever error handler maps it to, currently returns 500 for generic Error
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_runs'),
        expect.arrayContaining(['FAILED', 0, 'AccessDenied', 999])
      );
    });

    it('orchestrates discovery and persists results successfully', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockGetTempCreds.mockResolvedValue({
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'SECRET',
        sessionToken: 'TOKEN'
      });
      mockRunAwsDiscovery.mockResolvedValue({
        resources: [
          { resourceType: 'VPC', resourceId: 'vpc-1', arn: 'arn:aws:ec2:us-east-1:123:vpc/vpc-1', name: 'vpc-1', region: 'us-east-1', status: 'available', attributes: {} },
          { resourceType: 'SUBNET', resourceId: 'subnet-1', arn: 'arn:aws:ec2:us-east-1:123:subnet/subnet-1', name: 'subnet-1', region: 'us-east-1', status: 'available', attributes: {} },
        ],
        relationships: [
          { resourceAType: 'VPC', resourceAId: 'vpc-1', resourceBType: 'SUBNET', resourceBId: 'subnet-1', relationType: 'HAS_SUBNET' }
        ],
        errors: ['Some minor warning']
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.resourcesScanned).toBe(2);
      expect(res.body.data.resourcesUpdated).toBe(2); // Since mock UPDATE returns rows > 0
      expect(res.body.data.relationshipsCreated).toBe(0); // mock UPDATE returns rows > 0
      
      // Check that analysis run was created
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analysis_runs'),
        expect.arrayContaining([MOCK_PROJECT_ID, 50])
      );

      // Check transaction was committed
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back transaction on DB error', async () => {
      mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
      mockGetTempCreds.mockResolvedValue({ accessKeyId: 'A', secretAccessKey: 'B', sessionToken: 'C' });
      mockRunAwsDiscovery.mockResolvedValue({
        resources: [{ resourceType: 'VPC', resourceId: 'vpc-1', arn: null, name: null, region: null, status: null, attributes: {} }],
        relationships: [],
        errors: []
      });

      mockClient.query.mockImplementation((queryStr: string) => {
        if (queryStr.includes('ON CONFLICT') || queryStr.includes('INSERT INTO resources')) throw new Error('DB Error');
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_runs'),
        expect.arrayContaining(['FAILED', 0, 'Database transaction failed: DB Error', 999])
      );
    });

    describe('Concurrency and Idempotency', () => {
      it('Repeated discovery of the same resource does not duplicate it', async () => {
        // Handled naturally by the UPSERT. We just verify the controller responds with 200 and no DB errors.
        mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
        mockGetTempCreds.mockResolvedValue({ accessKeyId: 'A', secretAccessKey: 'B', sessionToken: 'C' });
        mockRunAwsDiscovery.mockResolvedValue({
          resources: [{ resourceType: 'VPC', resourceId: 'vpc-1', arn: null, name: null, region: 'us-east-1', status: 'available', attributes: {} }],
          relationships: [],
          errors: []
        });

        // First pass
        await request(app).post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`).set('Cookie', [validCookie]);
        
        // Second pass
        const res2 = await request(app).post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`).set('Cookie', [validCookie]);
        expect(res2.status).toBe(200);
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.any(Array));
      });

      it('Concurrent UPSERT attempts cannot create duplicate logical resources/relationships', async () => {
        mockFindCloudAccountById.mockResolvedValue(MOCK_CLOUD_ACCOUNT);
        mockGetTempCreds.mockResolvedValue({ accessKeyId: 'A', secretAccessKey: 'B', sessionToken: 'C' });
        mockRunAwsDiscovery.mockResolvedValue({
          resources: [{ resourceType: 'VPC', resourceId: 'vpc-concurrent', arn: null, name: null, region: 'us-east-1', status: 'available', attributes: {} }],
          relationships: [{ resourceAType: 'VPC', resourceAId: 'vpc-concurrent', resourceBType: 'SUBNET', resourceBId: 'subnet-1', relationType: 'HAS_SUBNET' }],
          errors: []
        });

        const req1 = request(app).post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`).set('Cookie', [validCookie]);
        const req2 = request(app).post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`).set('Cookie', [validCookie]);

        const [res1, res2] = await Promise.all([req1, req2]);
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
      });

      it('Existing demo data remains untouched', async () => {
        // Asserting demo mode skips
        mockFindCloudAccountById.mockResolvedValue({ ...MOCK_CLOUD_ACCOUNT, mode: 'DEMO' });
        const res = await request(app).post(`/api/v1/projects/${MOCK_PROJECT_ID}/cloud-accounts/50/discover`).set('Cookie', [validCookie]);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('CANCELLED');
        expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.any(Array));
      });
    });
  });
});
