/**
 * AtherOps Backend – Cloud Account Routes
 */

import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import {
  listCloudAccountsController,
  getCloudAccountController,
  getCloudAccountSetupController,
  createCloudAccountController,
  updateCloudAccountController,
  deleteCloudAccountController,
} from './cloudAccount.controller';
import { testAwsConnectionController } from './connection/connection.controller';
import { discoverAwsResourcesController } from '../aws-collector/aws-collector.controller';

const cloudAccountsRouter = Router();

// Apply auth middleware to all cloud account routes
cloudAccountsRouter.use(requireAuth);

// Routes scoped under /projects/:projectId/cloud-accounts are mounted in v1Router 
// as /projects/:projectId/cloud-accounts, but express Router by default doesn't 
// merge params. We need `mergeParams: true` so let's handle the mounting properly.
// Actually, it's easier to mount this directly inside the projects router OR
// export it with mergeParams. Let's do `mergeParams: true`.

export const cloudAccountsNestedRouter = Router({ mergeParams: true });

cloudAccountsNestedRouter.use(requireAuth);

cloudAccountsNestedRouter.get('/', listCloudAccountsController);
cloudAccountsNestedRouter.post('/', createCloudAccountController);

cloudAccountsNestedRouter.get('/:cloudAccountId', getCloudAccountController);
cloudAccountsNestedRouter.get('/:cloudAccountId/setup', getCloudAccountSetupController);
cloudAccountsNestedRouter.patch('/:cloudAccountId', updateCloudAccountController);
cloudAccountsNestedRouter.delete('/:cloudAccountId', deleteCloudAccountController);

cloudAccountsNestedRouter.post('/:cloudAccountId/connection-test', testAwsConnectionController);
cloudAccountsNestedRouter.post('/:cloudAccountId/discover', discoverAwsResourcesController);

// Import rule controller
import { evaluateAnalysisRunController } from '../../../modules/security/rules/rule.controller';

// Security Evaluation Route
cloudAccountsNestedRouter.post('/:cloudAccountId/analysis-runs/:analysisRunId/evaluate', evaluateAnalysisRunController);

import { analyzeAttackPathsController } from '../../../modules/attack-path/attack-path.controller';
cloudAccountsNestedRouter.post('/:cloudAccountId/analysis-runs/:analysisRunId/attack-paths/analyze', analyzeAttackPathsController);

import { getBillingDataController } from '../../../modules/billing/billing.controller';
cloudAccountsNestedRouter.get('/:cloudAccountId/billing', getBillingDataController);
