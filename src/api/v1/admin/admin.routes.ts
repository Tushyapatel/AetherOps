import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import * as controller from './admin.controller';

const router = Router();

// All admin routes require ADMIN role
router.use(requireAdmin);

router.get('/stats', controller.getPlatformStats);
router.get('/customers', controller.getCustomers);
router.patch('/customers/:id/status', controller.updateCustomerStatus);
router.get('/cloud-accounts', controller.getCloudAccounts);
router.get('/projects', controller.getProjects);
router.get('/audit-logs', controller.getAuditLogs);
router.delete('/users/:userId', controller.deleteCustomer);

export { router as adminRouter };

