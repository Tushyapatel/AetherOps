import { Request, Response, NextFunction } from 'express';
import { analyzeAttackPaths } from './attack-path.service';

export async function analyzeAttackPathsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projectId = parseInt(req.params.projectId as string || '', 10);
    const cloudAccountId = parseInt(req.params.cloudAccountId as string || '', 10);
    const analysisRunId = parseInt(req.params.analysisRunId as string || '', 10);

    if (isNaN(projectId) || isNaN(cloudAccountId) || isNaN(analysisRunId)) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const result = await analyzeAttackPaths(req.user!.id, projectId, cloudAccountId, analysisRunId);
    
    res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'Analysis run not found or does not belong to this project/account') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
