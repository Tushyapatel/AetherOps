/**
 * AtherOps Backend – Health Routes
 *
 * Mounts under the /api/v1 prefix (applied in the v1 router).
 */

import { Router } from 'express';
import { healthController } from './health.controller';

const healthRouter = Router();

/**
 * GET /health
 * Returns application and database health status.
 */
healthRouter.get('/', healthController);

export { healthRouter };
