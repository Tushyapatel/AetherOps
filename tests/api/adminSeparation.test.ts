import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';

jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
  query: jest.fn(),
  withClient: jest.fn(),
}));

jest.mock('../../src/api/v1/admin/admin.repository', () => ({
  getPlatformStats: jest.fn().mockResolvedValue({
    totalCustomers: 3,
    activeUsers: 5,
    blockedUsers: 0,
    totalProjects: 3,
    liveCloudAccounts: 0,
    demoCloudAccounts: 10,
    connectedCloudAccounts: 10,
    openFindings: { CRITICAL: 10, HIGH: 20, MEDIUM: 30 }
  }),
  getCustomers: jest.fn().mockResolvedValue([
    { id: 1, email: 'admin@atherops.com', role: 'admin', status: 'ACTIVE' },
    { id: 2, email: 'platform_admin@atherops.com', role: 'PLATFORM_ADMIN', status: 'ACTIVE' }
  ]),
  setCustomerStatus: jest.fn(),
  getAdminCloudAccounts: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  verify: (token: string, secret: string) => {
    if (token === 'legacy_admin_token') return { sub: '1', role: 'admin' };
    if (token === 'platform_admin_token') return { sub: '2', role: 'PLATFORM_ADMIN' };
    if (token === 'customer_token') return { sub: '3', role: 'CUSTOMER' };
    throw new Error('Invalid token');
  }
}));

jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserById: jest.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({ id: 1, email: 'admin@atherops.com', role: 'admin', status: 'ACTIVE' });
    if (id === 2) return Promise.resolve({ id: 2, email: 'platform_admin@atherops.com', role: 'PLATFORM_ADMIN', status: 'ACTIVE' });
    if (id === 3) return Promise.resolve({ id: 3, email: 'customer@example.com', role: 'CUSTOMER', status: 'ACTIVE' });
    return Promise.resolve(null);
  })
}));

const app = createApp();

describe('Admin Separation Hardening', () => {
  it('Legacy Admin (admin) should NOT have access to Platform Admin stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', `${config.cookie.name}=legacy_admin_token`);
    expect(res.status).toBe(401);
  });

  it('Customer should NOT have access to Platform Admin stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', `${config.cookie.name}=customer_token`);
    expect(res.status).toBe(401);
  });

  it('Platform Admin (PLATFORM_ADMIN) SHOULD have access to Platform Admin stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', `${config.cookie.name}=platform_admin_token`);
    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCustomers).toBe(3);
  });

  it('Platform Admin should see all users in customers list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/customers')
      .set('Cookie', `${config.cookie.name}=platform_admin_token`);
    expect(res.status).toBe(200);
    
    expect(res.body.data.find((u: any) => u.email === 'admin@atherops.com')).toBeDefined();
    expect(res.body.data.find((u: any) => u.email === 'platform_admin@atherops.com')).toBeDefined();
  });
});
