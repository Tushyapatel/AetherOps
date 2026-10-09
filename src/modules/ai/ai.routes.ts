/**
 * AtherOps – AI Routes
 *
 * Mounts all AI endpoints under /api/v1/projects/:projectId/ai/
 * All routes require authentication (enforced at project router level).
 */

import { Router } from 'express';
import { requireAuth } from '../../api/v1/auth/auth.middleware';
import {
  securityAnalysisController,
  projectOverviewController,
  costAnalysisController,
  attackPathAnalysisController,
  chatController,
} from './ai.controller';

const aiRouter = Router({ mergeParams: true });

aiRouter.use(requireAuth);

// POST /api/v1/projects/:projectId/ai/security-analysis
aiRouter.post('/security-analysis', securityAnalysisController);

// POST /api/v1/projects/:projectId/ai/overview
aiRouter.post('/overview', projectOverviewController);

// POST /api/v1/projects/:projectId/ai/cost-analysis
aiRouter.post('/cost-analysis', costAnalysisController);

// POST /api/v1/projects/:projectId/ai/attack-path-analysis
aiRouter.post('/attack-path-analysis', attackPathAnalysisController);

// POST /api/v1/projects/:projectId/ai/chat
aiRouter.post('/chat', chatController);

export default aiRouter;
