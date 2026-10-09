import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import * as adminRepo from '../../src/api/v1/admin/admin.repository';

jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
  query: jest.fn(),
  withClient: jest.fn(),
}));

jest.mock('../../src/api/v1/admin/admin.repository', () => ({
  deleteCustomer: jest.fn(),
  getPlatformStats: jest.fn(),
  getCustomers: jest.fn(),
  setCustomerStatus: jest.fn(),
  getAdminCloudAccounts: jest.fn(),
  getProjects: jest.fn(),
  getAuditLogs: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  verify: (token: string, _secret: string) => {
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
    if (id === 4) return Promise.resolve({ id: 4, email: 'customer2@example.com', role: 'CUSTOMER', status: 'ACTIVE' });
    return Promise.resolve(null);
  })
}));

const app = createApp();

describe('Admin Delete Customer Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CUSTOMER cannot access delete endpoint', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/users/4')
      .set('Cookie', `${config.cookie.name}=customer_token`);
    expect(res.status).toBe(401);
  });

  it('Admin cannot delete themselves', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/users/2')
      .set('Cookie', `${config.cookie.name}=platform_admin_token`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/cannot delete yourself/i);
  });

  it('Admin cannot delete a non-customer user', async () => {
    (adminRepo.deleteCustomer as jest.Mock).mockRejectedValueOnce(new Error('User is not a customer'));
    const res = await request(app)
      .delete('/api/v1/admin/users/1')
      .set('Cookie', `${config.cookie.name}=platform_admin_token`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/cannot delete non-customer/i);
  });

  it('Admin can delete a customer and dependent data is cleaned up', async () => {
    (adminRepo.deleteCustomer as jest.Mock).mockResolvedValueOnce(undefined);
    const res = await request(app)
      .delete('/api/v1/admin/users/3')
      .set('Cookie', `${config.cookie.name}=platform_admin_token`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/customer removed successfully/i);
    expect(adminRepo.deleteCustomer).toHaveBeenCalledWith(2, 3);
  });
});
