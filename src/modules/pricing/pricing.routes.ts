import { Router } from 'express';
import { requireAuth } from '../../api/v1/auth/auth.middleware';
import { comparePricingController } from './pricing.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// POST /api/v1/projects/:projectId/pricing/compare
router.post('/compare', comparePricingController);

// GET /api/v1/projects/:projectId/pricing/account/:cloudAccountId
import { compareAccountPricingController } from './pricing.controller';
router.get('/account/:cloudAccountId', compareAccountPricingController);

export default router;
