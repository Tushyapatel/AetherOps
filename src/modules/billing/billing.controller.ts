import { Request, Response } from 'express';
import { processBillingQuery } from './billing.service';
import { BillingQuery, Granularity } from './billing.types';
import { logger } from '../../logger';

export async function getBillingDataController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const cloudAccountId = parseInt(req.params.cloudAccountId as string, 10);
    
    if (isNaN(cloudAccountId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid cloud account ID format' } });
      return;
    }

    let { startDate, endDate } = req.query as { startDate?: string, endDate?: string };
    const { granularity } = req.query as { granularity?: string };
    
    // Default to current month if dates are not provided
    if (!startDate || !endDate) {
      const now = new Date();
      
      const formatYYYYMMDD = (d: Date) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // Start of current month in UTC
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      // Start of next month in UTC (AWS Cost Explorer End is exclusive)
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      
      startDate = startDate || formatYYYYMMDD(start);
      endDate = endDate || formatYYYYMMDD(end);
    }

    // Basic validation
    if (typeof startDate !== 'string' || !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      res.status(400).json({ success: false, error: { message: 'startDate must be in YYYY-MM-DD format' } });
      return;
    }
    
    if (typeof endDate !== 'string' || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      res.status(400).json({ success: false, error: { message: 'endDate must be in YYYY-MM-DD format' } });
      return;
    }

    if (startDate >= endDate) {
      res.status(400).json({ success: false, error: { message: 'startDate must be before endDate' } });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const oneYearMs = 366 * 24 * 60 * 60 * 1000; // 366 days max
    if (end.getTime() - start.getTime() > oneYearMs) {
      res.status(400).json({ success: false, error: { message: 'Date range cannot exceed 1 year' } });
      return;
    }

    let parsedGranularity: Granularity = 'DAILY';
    if (granularity === 'MONTHLY') {
      parsedGranularity = 'MONTHLY';
    } else if (granularity !== 'DAILY' && granularity !== undefined) {
      res.status(400).json({ success: false, error: { message: 'granularity must be DAILY or MONTHLY' } });
      return;
    }

    const query: BillingQuery = {
      startDate,
      endDate,
      granularity: parsedGranularity,
    };

    const data = await processBillingQuery(userId, projectId, cloudAccountId, query);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    if (error.status === 404) {
      res.status(404).json({ success: false, error: { message: 'Cloud account not found or access denied' } });
    } else if (error.status === 400) {
      res.status(400).json({ success: false, error: { message: error.message } });
    } else {
      logger.error('Billing controller error', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: { message: 'Internal server error processing billing data' } });
    }
  }
}
