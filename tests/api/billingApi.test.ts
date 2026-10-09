import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';
import { getPool } from '../../src/database';
import { fetchAwsBillingData } from '../../src/modules/billing/aws/cost-explorer.client';

jest.mock('../../src/database');
jest.mock('../../src/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

jest.mock('../../src/api/v1/auth/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'test@example.com', role: 'viewer' as const, status: 'ACTIVE' };
      next();
  },
  requireAdmin: (req: any, res: any, next: any) => { next(); }
}));

jest.mock('../../src/modules/billing/aws/cost-explorer.client', () => ({
  fetchAwsBillingData: jest.fn().mockResolvedValue([
    {
      TimePeriod: { Start: '2023-10-01', End: '2023-10-02' },
      Groups: [
        {
          Keys: ['Amazon Elastic Compute Cloud - Compute'],
          Metrics: { UnblendedCost: { Amount: '15.50', Unit: 'USD' } }
        }
      ]
    }
  ])
}));

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

(getPool as jest.Mock).mockReturnValue(mockPool);

describe('Billing API', () => {
  let app: any;
  let mockClient: any;
  const mockUserId = 1;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);

    // Default pool.query mock
    mockPool.query.mockImplementation((queryStr: string) => {
      // For findCloudAccountById
      if (queryStr.includes('SELECT ca.id')) {
        return Promise.resolve({
          rows: [{
            id: 101,
            project_id: 'proj-uuid',
            mode: 'AWS',
            role_arn: 'arn:aws:iam::123:role/AtherOpsRole',
            external_id: 'ext-id-123'
          }]
        });
      }

      // For fetchCosts
      if (queryStr.includes('FROM costs')) {
        return Promise.resolve({
          rows: [{
            accountId: 101,
            serviceName: 'Amazon Elastic Compute Cloud - Compute',
            periodStart: '2023-10-01',
            periodEnd: '2023-10-02',
            granularity: 'DAILY',
            metric: 'UnblendedCost',
            amount: '15.50',
            currency: 'USD'
          }]
        });
      }

      return Promise.resolve({ rows: [] });
    });

    // Default transaction query mock
    mockClient.query.mockResolvedValue({ rowCount: 1 });
  });

  const getAuthCookie = () => {
    const token = jwt.sign({ id: mockUserId }, process.env['JWT_SECRET'] || 'test-jwt-secret-at-least-32-characters-long!!');
    return `auth_token=${token}`;
  };
  
  it('should fetch billing data successfully for valid dates', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCost).toBe('15.50');
    expect(res.body.data.granularity).toBe('DAILY');
    expect(res.body.data.services.length).toBe(1);
    expect(res.body.data.services[0].service).toBe('Amazon Elastic Compute Cloud - Compute');
  });

  it('should reject invalid dates', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=invalid&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('startDate must be in YYYY-MM-DD format');
  });

  it('should reject startDate after endDate', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-05&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('startDate must be before endDate');
  });

  it('should reject date range exceeding 1 year', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2020-01-01&endDate=2021-02-01&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Date range cannot exceed 1 year');
  });

  it('should calculate insights deterministically without AI', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(200);
    expect(res.body.data.insights).toBeDefined();
    expect(res.body.data.insights.totalCost).toBe('15.50');
    expect(res.body.data.insights.averageDailyCost).toBeDefined();
    expect(res.body.data.insights.topServices.length).toBeGreaterThan(0);
    expect(res.body.data.insights.topServices[0].percentage).toBe('100.00'); // only 1 service in mock
  });

  it('should support MONTHLY granularity', async () => {
    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-11-01&granularity=MONTHLY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(200);
    expect(res.body.data.granularity).toBe('MONTHLY');
  });

  it('should handle $0.00 actual billing gracefully', async () => {
    // Override db mock to return 0.00
    mockPool.query.mockImplementationOnce((queryStr: string) => {
      if (queryStr.includes('SELECT ca.id')) {
        return Promise.resolve({ rows: [{ id: 101, project_id: 'proj-uuid', mode: 'AWS', role_arn: 'arn:123', external_id: 'ext123' }] });
      }
      return Promise.resolve({ rows: [] });
    }).mockImplementationOnce((queryStr: string) => {
      return Promise.resolve({ rows: [] }); // fetchCosts returns empty
    }).mockImplementationOnce((queryStr: string) => {
      if (queryStr.includes('FROM costs')) {
        return Promise.resolve({
          rows: [{
            accountId: 101, serviceName: 'AWS Backup', periodStart: '2023-10-01', periodEnd: '2023-10-02',
            granularity: 'DAILY', metric: 'UnblendedCost', amount: '0.00', currency: 'USD'
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(200);
    expect(res.body.data.totalCost).toBe('0.00');
  });

  it('should handle LIVE billing with no billing rows', async () => {
    // Override db mock to return empty array for fetchCosts
    mockPool.query.mockImplementation((queryStr: string) => {
      if (queryStr.includes('SELECT ca.id')) {
        return Promise.resolve({ rows: [{ id: 101, project_id: 'proj-uuid', mode: 'AWS', role_arn: 'arn:123', external_id: 'ext123' }] });
      }
      if (queryStr.includes('FROM costs')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(200);
    expect(res.body.data.totalCost).toBe('0.00');
    expect(res.body.data.services.length).toBe(0);
  });

  it('should handle AccessDenied / missing ce:GetCostAndUsage', async () => {
    (fetchAwsBillingData as jest.Mock).mockRejectedValueOnce(new Error('AccessDenied: User is not authorized to perform: ce:GetCostAndUsage'));

    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(500); // Or whatever status the error handler maps it to, typically 500 for unmapped errors
    expect(res.body.error.message).toContain('server error');
  });

  it('should handle Cost Explorer service failure', async () => {
    (fetchAwsBillingData as jest.Mock).mockRejectedValueOnce(new Error('InternalServerError'));

    const res = await request(app)
      .get('/api/v1/projects/proj-uuid/cloud-accounts/101/billing?startDate=2023-10-01&endDate=2023-10-02&granularity=DAILY')
      .set('Cookie', getAuthCookie());
      
    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('server error');
  });
});

