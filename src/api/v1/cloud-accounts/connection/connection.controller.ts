/**
 * AtherOps Backend – Connection Controller
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../../errors';
import { cloudAccountIdParamSchema, projectIdParamSchema } from '../cloudAccount.validation';
import { testAwsConnection } from './connection.service';

export async function testAwsConnectionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);

    const result = await testAwsConnection(accountId, projectId, req.user.id);

    // If it failed due to AWS reasons, we still return 200 OK because the API *call* succeeded.
    // The client reads the `connected: false` flag.
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
