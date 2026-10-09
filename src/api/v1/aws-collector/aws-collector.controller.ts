import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../errors';
import { runAwsCollection } from './aws-collector.service';
import { 
  projectIdParamSchema, 
  cloudAccountIdParamSchema 
} from '../cloud-accounts/cloudAccount.validation';

export async function discoverAwsResourcesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);
    
    const result = await runAwsCollection(projectId, accountId, req.user.id);
    
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
