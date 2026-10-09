/**
 * AtherOps Backend – Health Controller
 *
 * Handles GET /api/v1/health
 *
 * Response codes:
 *  200 – application and database are both healthy
 *  503 – application is running but database is unhealthy (degraded)
 */

import { Request, Response } from 'express';
import { checkDbHealth } from '../../../database';
import { config } from '../../../config';


export async function healthController(req: Request, res: Response): Promise<void> {
  const db = await checkDbHealth();

  const overallHealthy = db.status === 'healthy';
  const statusCode = overallHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: overallHealthy,
    data: {
      status: overallHealthy ? 'healthy' : 'degraded',
      environment: config.env,
      timestamp: new Date().toISOString(),
      version: config.api.version,
      services: {
        database: {
          status: db.status,
          latencyMs: db.latencyMs,
          serverVersion: db.serverVersion,
          ...(db.error && { error: db.error }),
        },
      },
    },
  });
}
