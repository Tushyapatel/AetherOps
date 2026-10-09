/**
 * AtherOps Backend – Cloud Account Controller
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../errors';
import { 
  cloudAccountIdParamSchema, 
  projectIdParamSchema, 
  createCloudAccountSchema, 
  updateCloudAccountSchema 
} from './cloudAccount.validation';
import {
  getCloudAccounts,
  getCloudAccount,
  getCloudAccountSetupDetails,
  createCloudAccount,
  updateCloudAccount,
  deleteCloudAccount,
} from './cloudAccount.service';

export async function listCloudAccountsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);

    const accounts = await getCloudAccounts(projectId, req.user.id);
    res.status(200).json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
}

export async function getCloudAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);

    const account = await getCloudAccount(accountId, projectId, req.user.id);
    res.status(200).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

export async function getCloudAccountSetupController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);
    
    const setupDetails = await getCloudAccountSetupDetails(accountId, projectId, req.user.id);
    res.status(200).json({ success: true, data: setupDetails });
  } catch (err) {
    next(err);
  }
}

export async function createCloudAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const input = createCloudAccountSchema.parse(req.body);

    const account = await createCloudAccount(req.user.id, projectId, input);
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

export async function updateCloudAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);
    const input = updateCloudAccountSchema.parse(req.body);

    const account = await updateCloudAccount(accountId, projectId, req.user.id, input);
    res.status(200).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

export async function deleteCloudAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdParamSchema.parse(req.params.projectId);
    const accountId = parseInt(cloudAccountIdParamSchema.parse(req.params.cloudAccountId), 10);

    await deleteCloudAccount(accountId, projectId, req.user.id);
    res.status(200).json({ success: true, data: { message: 'Cloud account disconnected successfully' } });
  } catch (err) {
    next(err);
  }
}
