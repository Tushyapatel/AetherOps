import * as repository from './admin.repository';
import { NotFoundError } from '../../../errors';
import { getPool } from '../../../database';

export async function getPlatformStats() {
  return repository.getPlatformStats();
}

export async function getCustomers() {
  return repository.getCustomers();
}

export async function setCustomerStatus(adminUserId: number, customerId: number, status: 'ACTIVE' | 'BLOCKED') {
  const result = await repository.updateCustomerStatus(customerId, status);
  if (!result) {
    throw new NotFoundError('Customer not found');
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      adminUserId,
      status === 'BLOCKED' ? 'ADMIN_USER_BLOCKED' : 'ADMIN_USER_UNBLOCKED',
      'USER',
      customerId,
      JSON.stringify({ targetUserId: customerId })
    ]
  );

  return result;
}

export async function getAdminCloudAccounts() {
  return repository.getAdminCloudAccounts();
}

export async function getProjects() {
  return repository.getProjects();
}

export async function getAuditLogs(limit?: number) {
  return repository.getAuditLogs(limit);
}

import { ValidationError } from '../../../errors';

export async function deleteCustomer(adminUserId: number, customerId: number) {
  if (adminUserId === customerId) {
    throw new ValidationError('Cannot delete yourself');
  }
  
  try {
    await repository.deleteCustomer(adminUserId, customerId);
  } catch(err: any) {
     if (err.message === 'User not found') {
       throw new NotFoundError('Customer not found');
     }
     if (err.message === 'User is not a customer') {
       throw new ValidationError('Cannot delete non-customer users');
     }
     throw err;
  }
  return true;
}

