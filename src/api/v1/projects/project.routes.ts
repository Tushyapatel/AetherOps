/**
 * AtherOps Backend – Project Routes
 *
 * All endpoints require authentication.
 */

import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { cloudAccountsNestedRouter } from '../cloud-accounts/cloudAccount.routes';
import {
  listProjectsController,
  getProjectController,
  createProjectController,
  updateProjectController,
  deleteProjectController,
} from './project.controller';

const projectsRouter = Router();

// Apply auth middleware to all project routes
projectsRouter.use(requireAuth);

// ── Cloud Accounts (Nested) ───────────────────────────────────────────────────
projectsRouter.use('/:projectId/cloud-accounts', cloudAccountsNestedRouter);

// ── Pricing (Nested) ────────────────────────────────────────────────────────
import pricingRouter from '../../../modules/pricing/pricing.routes';
projectsRouter.use('/:projectId/pricing', pricingRouter);

// ── AI Intelligence (Nested) ──────────────────────────────────────────────
import aiRouter from '../../../modules/ai/ai.routes';
projectsRouter.use('/:projectId/ai', aiRouter);

// ── Dashboard (Nested) ──────────────────────────────────────────────
import { dashboardRouter } from '../dashboard/dashboard.routes';
projectsRouter.use('/:projectId', dashboardRouter);

// ── Reports (Nested) ────────────────────────────────────────────────────────
import { reportRouter } from '../reports/report.routes';
projectsRouter.use('/:projectId/reports', reportRouter);


projectsRouter.get('/', listProjectsController);
projectsRouter.post('/', createProjectController);

projectsRouter.get('/:projectId', getProjectController);
projectsRouter.patch('/:projectId', updateProjectController);
projectsRouter.delete('/:projectId', deleteProjectController);

export { projectsRouter };
