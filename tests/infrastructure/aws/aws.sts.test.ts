/**
 * AtherOps – Test: AWS STS Operations
 */

import { getTemporaryCredentials, verifyAwsConnection, getAwsHostIdentity } from '../../../src/infrastructure/aws/aws.sts';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

// Mock STSClient
jest.mock('@aws-sdk/client-sts', () => {
  return {
    STSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    AssumeRoleCommand: jest.fn(),
    GetCallerIdentityCommand: jest.fn(),
  };
});

describe('AWS STS Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemporaryCredentials', () => {
    it('creates fresh STSClient per call to avoid caching credential failures', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIA...',
          SecretAccessKey: 'SECRET...',
          SessionToken: 'SESSION...',
        },
      });
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      await getTemporaryCredentials('arn:aws:iam::123:role/Test', 'ext-123');

      expect(STSClient).toHaveBeenCalledTimes(1);
      expect(STSClient).toHaveBeenCalledWith({});
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('verifyAwsConnection error handling', () => {
    it('maps missing credentials to user-friendly message', async () => {
      // Mock getAwsHostIdentity failure so it doesn't block
      const mockSend = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Could not load credentials from any providers'), { name: 'CredentialsProviderError' }))
        .mockRejectedValueOnce(Object.assign(new Error('Could not load credentials from any providers'), { name: 'CredentialsProviderError' }));
      
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn', 'ext', '123');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('AtherOps could not load AWS credentials for this connection test.');
    });

    it('maps AccessDenied to IAM trust policy hint', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:user/Dev', Account: '123' }) // host identity (not root)
        .mockRejectedValueOnce(Object.assign(new Error('Access Denied'), { name: 'AccessDenied' })); // assume role fails
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn', 'ext', '123');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('AWS denied the role assumption. Check the IAM role trust policy and External ID.');
    });

    it('maps ValidationError to invalid ARN hint', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:user/Dev', Account: '123' })
        .mockRejectedValueOnce(Object.assign(new Error('ValidationError'), { name: 'ValidationError' }));
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn', 'ext', '123');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('The AWS role ARN is invalid.');
    });

    it('maps ExpiredToken to session expired hint', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:user/Dev', Account: '123' })
        .mockRejectedValueOnce(Object.assign(new Error('ExpiredToken'), { name: 'ExpiredToken' }));
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn', 'ext', '123');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('The AWS local session has expired. Sign in to AWS again and retry.');
    });

    it('blocks root principal identity proactively', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:root', Account: '123' }); // host identity is root
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn', 'ext', '123');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('AWS root credentials cannot be used to assume the customer role. Use a non-root IAM role or supported temporary AWS identity.');
    });
  });

  describe('getAwsHostIdentity', () => {
    it('detects root principal correctly', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Arn: 'arn:aws:iam::123456789012:root',
        Account: '123456789012',
      });
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await getAwsHostIdentity();
      expect(result).not.toBeNull();
      expect(result?.isRoot).toBe(true);
      expect(result?.accountId).toBe('123456789012');
    });

    it('detects non-root principal correctly', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Arn: 'arn:aws:iam::123456789012:user/Dev',
        Account: '123456789012',
      });
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await getAwsHostIdentity();
      expect(result?.isRoot).toBe(false);
    });

    it('returns null on credentials failure without throwing', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('No creds'));
      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await getAwsHostIdentity();
      expect(result).toBeNull();
    });
  });

  describe('AssumeRole success path', () => {
    it('successfully assumes role and verifies identity', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:user/Dev', Account: '123' }) // Host identity
        .mockResolvedValueOnce({
          Credentials: {
            AccessKeyId: 'AKIA_TEMP',
            SecretAccessKey: 'SECRET_TEMP',
            SessionToken: 'SESSION_TEMP',
          }
        }) // AssumeRole
        .mockResolvedValueOnce({
          Account: '555555555555',
          Arn: 'arn:aws:sts::555555555555:assumed-role/Test',
        }) // GetCallerIdentity inside verify
        .mockRejectedValueOnce(Object.assign(new Error('AccessDenied'), { name: 'AccessDenied' })); // Negative test

      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn:aws:iam::555555555555:role/Test', 'ext', '555555555555');
      
      expect(result.connected).toBe(true);
      expect(result.awsAccountId).toBe('555555555555');
      expect(result.trustPolicyVerified).toBe(true);
    });

    it('fails if negative trust policy check succeeds', async () => {
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Arn: 'arn:aws:iam::123:user/Dev', Account: '123' }) // Host identity
        .mockResolvedValueOnce({
          Credentials: {
            AccessKeyId: 'AKIA_TEMP',
            SecretAccessKey: 'SECRET_TEMP',
            SessionToken: 'SESSION_TEMP',
          }
        }) // AssumeRole
        .mockResolvedValueOnce({
          Account: '555555555555',
          Arn: 'arn:aws:sts::555555555555:assumed-role/Test',
        }) // GetCallerIdentity inside verify
        .mockResolvedValueOnce({
          Credentials: { AccessKeyId: 'BAD' } // Negative test succeeds (which is bad)
        }); 

      (STSClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      const result = await verifyAwsConnection('arn:aws:iam::555555555555:role/Test', 'ext', '555555555555');
      
      expect(result.connected).toBe(false);
      expect(result.trustPolicyVerified).toBe(false);
      expect(result.error).toContain('Insecure AWS Trust Policy');
    });
  });
});
