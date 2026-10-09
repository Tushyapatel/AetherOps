/**
 * AtherOps Backend – Connection Service
 *
 * Checks AWS connection semantics safely.
 */

import { NotFoundError, ValidationError } from '../../../../errors';
import { findCloudAccountById } from '../cloudAccount.repository';
import { verifyAwsConnection } from '../../../../infrastructure/aws/aws.sts';
import { getPool } from '../../../../database';

export async function testAwsConnection(
  accountId: number,
  projectId: string,
  userId: number
) {
  // 1. Enforce ownership chain natively through the repository
  const cloudAccount = await findCloudAccountById(accountId, projectId, userId);

  if (!cloudAccount) {
    throw new NotFoundError('Cloud Account');
  }

  if (!cloudAccount.role_arn) {
    throw new ValidationError('Role ARN is not configured for this cloud account');
  }

  // 2. Structural ARN Check (fail fast before calling AWS)
  const arnRegex = /^arn:aws(-us-gov|-cn)?:iam::(\d{12}):role\/.+$/;
  const match = cloudAccount.role_arn.match(arnRegex);

  if (!match) {
    throw new ValidationError('Configured Role ARN is invalid');
  }

  const arnAccountId = match[2];
  if (arnAccountId !== cloudAccount.account_id) {
    throw new ValidationError('Role ARN account ID does not match the configured Cloud Account ID');
  }

  // Audit event started
  await getPool().query(
    `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      projectId,
      'AWS_CONNECTION_TEST_STARTED',
      'cloud_account',
      accountId,
      JSON.stringify({ account_id: cloudAccount.account_id }),
    ]
  );

  // 3. Call AWS safely
  const result = await verifyAwsConnection(
    cloudAccount.role_arn,
    cloudAccount.external_id,
    cloudAccount.account_id
  );

  // Audit event result
  let auditAction = 'AWS_CONNECTION_FAILED';
  if (result.connected && result.trustPolicyVerified) {
    auditAction = 'AWS_CONNECTION_VERIFIED';
  } else if (!result.trustPolicyVerified && result.roleVerified && result.identityVerified) {
    auditAction = 'AWS_TRUST_POLICY_INSECURE';
  }

  const auditDetails = {
    account_id: cloudAccount.account_id,
    error: result.error,
  };

  await getPool().query(
    `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      projectId,
      auditAction,
      'cloud_account',
      accountId,
      JSON.stringify(auditDetails),
    ]
  );

  return {
    provider: 'AWS',
    account_id: cloudAccount.account_id,
    connected: result.connected,
    role_verified: result.roleVerified,
    identity_verified: result.identityVerified,
    trust_policy_verified: result.trustPolicyVerified,
    error: result.error,
  };
}
