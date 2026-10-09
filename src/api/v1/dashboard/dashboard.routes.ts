import { Router } from 'express';
import {
  getRiskController,
  getFindingsController,
  getResourcesController,
  getAttackPathsController,
  getCostsController
} from './dashboard.controller';

const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get('/risk', getRiskController);
dashboardRouter.get('/findings', getFindingsController);
dashboardRouter.get('/resources', getResourcesController);
dashboardRouter.get('/attack-paths', getAttackPathsController);
dashboardRouter.get('/costs', getCostsController);

export { dashboardRouter };
