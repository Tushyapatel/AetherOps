/**
 * AtherOps Backend – AWS Infrastructure Layer
 *
 * Implements STS AssumeRole and GetCallerIdentity calls.
 * Ensures temporary credentials only exist in memory.
 */

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import * as crypto from 'crypto';

// Reusing standard Node.js credentials configured via environment.
// For production, the instance this app runs on will have a role/profile capable of assuming roles.
// To avoid caching a missing credentials state across a long-running dev server,
// STSClient is instantiated per request.

export interface AwsHostIdentity {
  arn: string;
  accountId: string;
  isRoot: boolean;
}

export interface VerifyConnectionResult {
  connected: boolean;
  awsAccountId: string | null;
  roleVerified: boolean;
  identityVerified: boolean;
  trustPolicyVerified: boolean;
  error?: string;
}

export async function getTemporaryCredentials(
  roleArn: string,
  externalId: string
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string }> {
  const assumeRoleCommand = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: 'AtherOpsCollectorSession',
    ExternalId: externalId,
    DurationSeconds: 900,
  });

  const stsClient = new STSClient({});
  const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
  const credentials = assumeRoleResponse.Credentials;

  if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey) {
    throw new Error('Failed to obtain temporary credentials from AssumeRole');
  }

  return {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken,
  };
}

export async function getAwsHostIdentity(): Promise<AwsHostIdentity | null> {
  try {
    const stsClient = new STSClient({});
    const cmd = new GetCallerIdentityCommand({});
    const response = await stsClient.send(cmd);
    
    if (!response.Arn || !response.Account) return null;
    
    return {
      arn: response.Arn,
      accountId: response.Account,
      isRoot: response.Arn.endsWith(':root')
    };
  } catch (_error) {
    // If credentials are missing or STS fails, we cannot determine host identity
    return null;
  }
}

export async function verifyAwsConnection(
  roleArn: string,
  externalId: string,
  expectedAccountId: string
): Promise<VerifyConnectionResult> {
  try {
    // 0. Pre-check: Ensure the host environment is not using root credentials
    const hostIdentity = await getAwsHostIdentity();
    if (hostIdentity && hostIdentity.isRoot) {
      return {
        connected: false,
        awsAccountId: null,
        roleVerified: false,
        identityVerified: false,
        trustPolicyVerified: false,
        error: 'AWS root credentials cannot be used to assume the customer role. Use a non-root IAM role or supported temporary AWS identity.',
      };
    }

    // 1. Assume the target role using the correct external ID
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: 'AtherOpsConnectionTest',
      ExternalId: externalId,
      DurationSeconds: 900,
    });

    const stsClient = new STSClient({});
    const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
    const credentials = assumeRoleResponse.Credentials;

    if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey) {
      return {
        connected: false,
        awsAccountId: null,
        roleVerified: false,
        identityVerified: false,
        trustPolicyVerified: false,
        error: 'Failed to obtain temporary credentials from AssumeRole',
      };
    }

    // 2. Verify identity using GetCallerIdentity
    const tempStsClient = new STSClient({
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
      },
    });

    const getCallerIdentityCommand = new GetCallerIdentityCommand({});
    const callerIdentity = await tempStsClient.send(getCallerIdentityCommand);
    const actualAccountId = callerIdentity.Account;

    if (!actualAccountId) {
      return {
        connected: false,
        awsAccountId: null,
        roleVerified: true,
        identityVerified: false,
        trustPolicyVerified: false,
        error: 'GetCallerIdentity did not return an account ID',
      };
    }

    if (actualAccountId !== expectedAccountId) {
      return {
        connected: false,
        awsAccountId: actualAccountId,
        roleVerified: true,
        identityVerified: false,
        trustPolicyVerified: false,
        error: 'AWS Account ID mismatch. The configured role does not belong to the expected AWS account.',
      };
    }

    // 3. Negative test: verify that the role trust policy correctly requires the external ID.
    // We attempt AssumeRole with a random UUID. If it succeeds, the trust policy is insecure.
    const negativeTestExternalId = crypto.randomUUID();
    let isTrustPolicyInsecure = false;

    try {
      const negativeAssumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'AtherOpsNegativeTest',
        ExternalId: negativeTestExternalId,
        DurationSeconds: 900,
      });
      const stsClient = new STSClient({});
      await stsClient.send(negativeAssumeRoleCommand);
      // If we reach here, the AssumeRole succeeded with the wrong ExternalId!
      isTrustPolicyInsecure = true;
    } catch (_negativeError: any) {
      // Expected behavior: AccessDenied means the trust policy properly blocked the incorrect ExternalId.
      isTrustPolicyInsecure = false;
    }

    return {
      connected: !isTrustPolicyInsecure, // Connection is not considered fully verified if trust policy is broken
      awsAccountId: actualAccountId,
      roleVerified: true,
      identityVerified: true,
      trustPolicyVerified: !isTrustPolicyInsecure,
      error: isTrustPolicyInsecure 
        ? 'Insecure AWS Trust Policy: The IAM role allowed assumption with an incorrect ExternalId. Please configure sts:ExternalId condition.'
        : undefined,
    };

  } catch (error: any) {
    let safeErrorMessage: string;
    const errName = error.name || 'Unknown';
    
    if (errName === 'AccessDenied' || errName === 'AccessDeniedException') {
      safeErrorMessage = 'AWS denied the role assumption. Check the IAM role trust policy and External ID.';
    } else if (errName === 'ValidationError') {
      safeErrorMessage = 'The AWS role ARN is invalid.';
    } else if (errName === 'CredentialsProviderError' || (errName === 'Error' && error.message?.toLowerCase().includes('credentials'))) {
      safeErrorMessage = 'AtherOps could not load AWS credentials for this connection test.';
    } else if (errName === 'ExpiredToken' || errName === 'ExpiredTokenException') {
      safeErrorMessage = 'The AWS local session has expired. Sign in to AWS again and retry.';
    } else {
      safeErrorMessage = `AWS Error: ${errName}`;
    }

    return {
      connected: false,
      awsAccountId: null,
      roleVerified: false,
      identityVerified: false,
      trustPolicyVerified: false,
      error: safeErrorMessage,
    };
  }
}
