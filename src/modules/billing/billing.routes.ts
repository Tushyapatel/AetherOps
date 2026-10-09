import { Router } from 'express';
import { requireAuth } from '../../api/v1/auth/auth.middleware';
import { getBillingDataController } from './billing.controller';

const router = Router();

// Notice: We mount this on /api/v1/projects in the main app
router.get(
  '/:projectId/cloud-accounts/:cloudAccountId/billing',
  requireAuth,
  getBillingDataController
);

export const billingRoutes = router;
