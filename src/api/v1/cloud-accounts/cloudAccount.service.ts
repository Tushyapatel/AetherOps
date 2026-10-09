/**
 * AtherOps Backend – Cloud Account Service
 *
 * Implements business logic and checks ownership boundaries.
 */

import { config } from '../../../config';
import { ConflictError, NotFoundError } from '../../../errors';
import {
  findCloudAccountsByProject,
  findCloudAccountById,
  checkProjectOwnership,
  checkAccountInProject,
  createCloudAccount as createAccountRepo,
  updateCloudAccount as updateAccountRepo,
  disconnectCloudAccount as disconnectAccountRepo,
} from './cloudAccount.repository';
import { CloudAccount, CloudAccountRow } from './cloudAccount.types';
import type { CreateCloudAccountInput, UpdateCloudAccountInput } from './cloudAccount.validation';
import { getAwsHostIdentity } from '../../../infrastructure/aws/aws.sts';

function toPublicCloudAccount(row: CloudAccountRow): CloudAccount {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    provider: row.provider,
    accountId: row.account_id,
    accountName: row.account_name,
    environment: row.environment,
    region: row.region,
    mode: row.mode,
    description: row.description,
    roleArn: row.role_arn,
    createdAt: row.created_at,
    lastScannedAt: row.last_scanned_at,
  };
}

export async function getCloudAccounts(projectId: string, userId: number): Promise<CloudAccount[]> {
  // Check project ownership first. If project isn't theirs (or doesn't exist), return 404.
  const ownsProject = await checkProjectOwnership(projectId, userId);
  if (!ownsProject) {
    throw new NotFoundError('Project');
  }

  const rows = await findCloudAccountsByProject(projectId, userId);
  return rows.map(toPublicCloudAccount);
}

export async function getCloudAccount(
  accountId: number,
  projectId: string,
  userId: number
): Promise<CloudAccount> {
  const row = await findCloudAccountById(accountId, projectId, userId);
  if (!row) {
    throw new NotFoundError('Cloud Account');
  }
  return toPublicCloudAccount(row);
}

export async function getCloudAccountSetupDetails(
  accountId: number,
  projectId: string,
  userId: number
) {
  const row = await findCloudAccountById(accountId, projectId, userId);
  if (!row) {
    throw new NotFoundError('Cloud Account');
  }
  let servicePrincipalArn = config.cloudApis.atheropsServicePrincipalArn || null;
  
  if (!servicePrincipalArn) {
    const hostIdentity = await getAwsHostIdentity();
    if (hostIdentity) {
      if (hostIdentity.isRoot) {
        // DEVELOPMENT-ONLY identity condition: AWS Root accounts cannot assume roles.
        // We refuse to pretend this is a valid AtherOps service principal.
        servicePrincipalArn = null;
      } else {
        servicePrincipalArn = hostIdentity.arn;
      }
    }
  }

  return {
    accountId: row.account_id,
    provider: row.provider,
    roleArn: row.role_arn,
    externalId: row.external_id,
    servicePrincipalArn,
    setupInstructions: "Configure your AWS IAM Role Trust Policy to require sts:ExternalId strictly matching the provided externalId."
  };
}

export async function createCloudAccount(
  userId: number,
  projectId: string,
  input: CreateCloudAccountInput
): Promise<CloudAccount> {
  // 1. Check if user owns the project
  const ownsProject = await checkProjectOwnership(projectId, userId);
  if (!ownsProject) {
    throw new NotFoundError('Project');
  }

  // 2. Prevent adding the same AWS account ID multiple times to the *same* project
  const alreadyInProject = await checkAccountInProject(projectId, input.account_id);
  if (alreadyInProject) {
    throw new ConflictError('This AWS account is already linked to this project.');
  }

  const row = await createAccountRepo(userId, projectId, {
    ...input,
    environment: input.environment ?? null,
    description: input.description ?? null,
    role_arn: input.role_arn ?? null,
  });
  return toPublicCloudAccount(row);
}

export async function updateCloudAccount(
  accountId: number,
  projectId: string,
  userId: number,
  input: UpdateCloudAccountInput
): Promise<CloudAccount> {
  // Repository enforces ownership chain
  const updatedRow = await updateAccountRepo(accountId, projectId, userId, input);
  
  if (!updatedRow) {
    throw new NotFoundError('Cloud Account');
  }

  return toPublicCloudAccount(updatedRow);
}

export async function deleteCloudAccount(
  accountId: number,
  projectId: string,
  userId: number
): Promise<void> {
  // Repository enforces ownership chain
  const disconnected = await disconnectAccountRepo(accountId, projectId, userId);
  
  if (!disconnected) {
    throw new NotFoundError('Cloud Account');
  }
}
