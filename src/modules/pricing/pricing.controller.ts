import { Request, Response } from 'express';
import { PricingService } from './pricing.service';

import { getProject } from '../../api/v1/projects/project.service';
import { logger } from '../../logger';
import { NotFoundError } from '../../errors';

const pricingService = new PricingService();

export async function comparePricingController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const projectId = req.params.projectId as string;
    if (!projectId || !projectId.match(/^[0-9a-fA-F-]+$/)) {
      res.status(400).json({ success: false, error: { message: 'Invalid projectId format' } });
      return;
    }

    // Verify ownership
    try {
      await getProject(projectId, userId);
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ success: false, error: { message: 'Project not found or access denied' } });
        return;
      }
      throw err;
    }

    const payload = req.body as any;

    if (!payload.region || !['INDIA', 'US_EAST'].includes(payload.region)) {
      res.status(400).json({ success: false, error: { message: 'Invalid or missing region' } });
      return;
    }

    // Legacy single-category request (backward compatibility for existing tests)
    if (payload.category) {
      if (!['COMPUTE', 'OBJECT_STORAGE', 'RELATIONAL_DATABASE'].includes(payload.category)) {
        res.status(400).json({ success: false, error: { message: 'Invalid or missing category' } });
        return;
      }
      if (!payload.workload || typeof payload.workload !== 'object') {
        res.status(400).json({ success: false, error: { message: 'Missing workload definition' } });
        return;
      }
      if (payload.category === 'COMPUTE' || payload.category === 'RELATIONAL_DATABASE') {
        if (!payload.workload.cpu || typeof payload.workload.cpu !== 'number') {
          res.status(400).json({ success: false, error: { message: 'cpu required for compute/database workloads' } });
          return;
        }
        if (!payload.workload.memoryGb || typeof payload.workload.memoryGb !== 'number') {
          res.status(400).json({ success: false, error: { message: 'memoryGb required for compute/database workloads' } });
          return;
        }
      }
      if (payload.category === 'OBJECT_STORAGE') {
        if (!payload.workload.storageGb || typeof payload.workload.storageGb !== 'number') {
          res.status(400).json({ success: false, error: { message: 'storageGb required for storage workloads' } });
          return;
        }
      }

      const result = await pricingService.comparePricing(payload as import('./pricing.types').PricingComparisonRequest);
      res.status(200).json({ success: true, data: result });
      return;
    }

    // New Combined Workload request
    if (!payload.compute && !payload.storage && !payload.database) {
      res.status(400).json({ success: false, error: { message: 'Missing workload definition' } });
      return;
    }

    const result = await pricingService.compareCombinedPricing(payload as import('./pricing.types').CombinedPricingComparisonRequest);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    logger.error('Error in comparePricingController', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: { message: 'Internal server error processing pricing data' } });
  }
}

export async function compareAccountPricingController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const projectId = req.params.projectId as string;
    if (!projectId || !projectId.match(/^[0-9a-fA-F-]+$/)) {
      res.status(400).json({ success: false, error: { message: 'Invalid projectId format' } });
      return;
    }

    const cloudAccountIdParam = req.params.cloudAccountId as string;
    const cloudAccountId = parseInt(cloudAccountIdParam, 10);
    if (isNaN(cloudAccountId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid cloudAccountId' } });
      return;
    }

    // Verify ownership
    try {
      await getProject(projectId, userId);
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ success: false, error: { message: 'Project not found or access denied' } });
        return;
      }
      throw err;
    }

    const result = await pricingService.compareCurrentAccount(projectId, cloudAccountId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    logger.error('Error in compareAccountPricingController', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: { message: 'Internal server error processing account pricing data' } });
  }
}
