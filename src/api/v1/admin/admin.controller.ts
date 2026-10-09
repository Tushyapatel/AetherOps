import { Request, Response, NextFunction } from 'express';
import * as service from './admin.service';
import { z } from 'zod';
import { ValidationError } from '../../../errors';

export async function getPlatformStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await service.getPlatformStats();
    res.status(200).json({ success: true, data: stats });
  } catch(err) { next(err); }
}

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const customers = await service.getCustomers();
    res.status(200).json({ success: true, data: customers });
  } catch(err) { next(err); }
}

const UpdateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'BLOCKED'])
});

export async function updateCustomerStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = parseInt(req.params.id as string, 10);
    if (isNaN(customerId)) {
      throw new ValidationError('Invalid customer ID');
    }

    const parsed = UpdateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid status');
    }

    const result = await service.setCustomerStatus(req.user!.id, customerId, parsed.data.status);
    res.status(200).json({ success: true, data: result });
  } catch(err) { next(err); }
}

export async function getCloudAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await service.getAdminCloudAccounts();
    res.status(200).json({ success: true, data: accounts });
  } catch(err) { next(err); }
}

export async function getProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await service.getProjects();
    res.status(200).json({ success: true, data: projects });
  } catch(err) { next(err); }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await service.getAuditLogs(limit);
    res.status(200).json({ success: true, data: logs });
  } catch(err) { next(err); }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = parseInt(req.params.userId as string, 10);
    if (isNaN(customerId)) {
      throw new ValidationError('Invalid user ID');
    }

    await service.deleteCustomer(req.user!.id, customerId);
    res.status(200).json({ success: true, message: 'Customer removed successfully' });
  } catch(err) { next(err); }
}

