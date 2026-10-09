import { Request, Response, NextFunction } from 'express';
import { getProject } from '../projects/project.service';
import {
  getProjectRiskScores,
  getProjectRiskHistory,
  getProjectFindings,
  getProjectResources,
  getProjectAttackPaths,
  getProjectCosts
} from './dashboard.repository';

// Helper to validate project access
async function validateProjectAccess(req: Request): Promise<number> {
  const projectIdStr = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(projectIdStr, 10);
  if (isNaN(projectId)) throw new Error('Invalid project ID');
  await getProject(projectId.toString(), req.user!.id);
  return projectId;
}

export async function getRiskController(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = await validateProjectAccess(req);
    const risk = await getProjectRiskScores(projectId);
    const history = await getProjectRiskHistory(projectId);
    res.json({ success: true, data: { current: risk, history } });
  } catch (err) {
    next(err);
  }
}

export async function getFindingsController(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = await validateProjectAccess(req);
    const findings = await getProjectFindings(projectId);
    res.json({ success: true, data: findings });
  } catch (err) {
    next(err);
  }
}

export async function getResourcesController(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = await validateProjectAccess(req);
    const resources = await getProjectResources(projectId);
    res.json({ success: true, data: resources });
  } catch (err) {
    next(err);
  }
}

export async function getAttackPathsController(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = await validateProjectAccess(req);
    const paths = await getProjectAttackPaths(projectId);
    res.json({ success: true, data: paths });
  } catch (err) {
    next(err);
  }
}

export async function getCostsController(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = await validateProjectAccess(req);
    const costs = await getProjectCosts(projectId);

    // Determine billing_source from the metric field on the cost rows.
    // SIMULATED_BILLING → SIMULATED_DEMO (synthetic demo data, not real AWS Cost Explorer)
    // Anything else (or real AWS) → ACTUAL_AWS
    const hasSimulated = costs.some((c: any) => c.metric === 'SIMULATED_BILLING');
    const hasActual = costs.some((c: any) => c.metric !== 'SIMULATED_BILLING' && c.metric);
    let billing_source: 'SIMULATED_DEMO' | 'ACTUAL_AWS' | 'MIXED' | 'NONE';
    if (costs.length === 0) {
      billing_source = 'NONE';
    } else if (hasSimulated && hasActual) {
      billing_source = 'MIXED';
    } else if (hasSimulated) {
      billing_source = 'SIMULATED_DEMO';
    } else {
      billing_source = 'ACTUAL_AWS';
    }

    res.json({ success: true, data: costs, meta: { billing_source } });
  } catch (err) {
    next(err);
  }
}

