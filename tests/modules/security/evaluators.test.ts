import { sg001Evaluator } from '../../../src/modules/security/evaluators/security-group.rules';
import { s3001Evaluator, s3002Evaluator } from '../../../src/modules/security/evaluators/s3.rules';
import { iam001Evaluator, iam002Evaluator, iam003Evaluator } from '../../../src/modules/security/evaluators/iam.rules';
import { rds001Evaluator, rds002Evaluator } from '../../../src/modules/security/evaluators/rds.rules';
import { ec2001Evaluator } from '../../../src/modules/security/evaluators/ec2.rules';
import { lambda001Evaluator } from '../../../src/modules/security/evaluators/lambda.rules';

describe('Security Evaluators', () => {
  describe('SG-001', () => {
    it('flags public SSH', () => {
      const results = sg001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'SECURITY_GROUP', resourceId: 'sg-1',
            arn: 'arn', name: 'sg', region: 'us-east-1', status: 'ok',
            attributes: {
              ipPermissions: [
                { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] }
              ]
            }
          }
        ],
        relationships: []
      });
      expect(results).toHaveLength(1);
      expect(results[0].ruleCode).toBe('SG-001');
      expect(results[0].severity).toBe('HIGH');
    });

    it('does not flag private SSH', () => {
      const results = sg001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'SECURITY_GROUP', resourceId: 'sg-1',
            arn: 'arn', name: 'sg', region: 'us-east-1', status: 'ok',
            attributes: {
              ipPermissions: [
                { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '10.0.0.0/8' }] }
              ]
            }
          }
        ],
        relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('S3-001', () => {
    it('flags explicit public access via ACL', () => {
      const results = s3001Evaluator.evaluate({
        resources: [
          {
            id: 2, accountId: 1, resourceType: 'S3', resourceId: 'b1', arn: '', name: '', region: '', status: '',
            attributes: {
              acl: { Grants: [{ Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' }, Permission: 'READ' }] }
            }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });

    it('returns nothing if insufficient data', () => {
      const results = s3001Evaluator.evaluate({
        resources: [
          {
            id: 2, accountId: 1, resourceType: 'S3', resourceId: 'b1', arn: '', name: '', region: '', status: '',
            attributes: {}
          }
        ], relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('S3-002', () => {
    it('flags missing encryption', () => {
      const results = s3002Evaluator.evaluate({
        resources: [
          {
            id: 2, accountId: 1, resourceType: 'S3', resourceId: 'b1', arn: '', name: '', region: '', status: '',
            attributes: { encryptionEnabled: false }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });

    it('does not infer missing data as insecure', () => {
      const results = s3002Evaluator.evaluate({
        resources: [
          {
            id: 2, accountId: 1, resourceType: 'S3', resourceId: 'b1', arn: '', name: '', region: '', status: '',
            attributes: {}
          }
        ], relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('IAM-001', () => {
    it('flags missing MFA', () => {
      const results = iam001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'IAM_USER', resourceId: 'u1', arn: '', name: '', region: '', status: '',
            attributes: { mfaEnabled: false }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });

    it('does not generate finding when INSUFFICIENT DATA (mfaEnabled is undefined)', () => {
      const results = iam001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'IAM_USER', resourceId: 'u1', arn: '', name: '', region: '', status: '',
            attributes: {} // mfaEnabled is undefined
          }
        ], relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('IAM-002', () => {
    it('flags old access key', () => {
      const results = iam002Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'IAM_ACCESS_KEY', resourceId: 'k1', arn: '', name: '', region: '', status: '',
            attributes: { ageDays: 100 }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });

    it('does not generate finding when INSUFFICIENT DATA (dates are undefined)', () => {
      const results = iam002Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'IAM_ACCESS_KEY', resourceId: 'k1', arn: '', name: '', region: '', status: '',
            attributes: {} // no ageDays, createDate, lastUsedDate
          }
        ], relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('IAM-003', () => {
    it('flags wildcard admin policy', () => {
      const results = iam003Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'IAM_ROLE', resourceId: 'r1', arn: '', name: '', region: '', status: '',
            attributes: {
              policyDocument: { Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] }
            }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });
  });

  describe('RDS-001', () => {
    it('flags public RDS', () => {
      const results = rds001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'RDS', resourceId: 'rds1', arn: '', name: '', region: '', status: '',
            attributes: { publiclyAccessible: true }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });
  });

  describe('RDS-002', () => {
    it('flags unencrypted RDS', () => {
      const results = rds002Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'RDS', resourceId: 'rds1', arn: '', name: '', region: '', status: '',
            attributes: { storageEncrypted: false }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(1);
    });
  });

  describe('EC2-001', () => {
    it('returns empty array because of insufficient data', () => {
      const results = ec2001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'EC2_INSTANCE', resourceId: 'ec2-1', arn: '', name: '', region: '', status: '',
            attributes: { publicIp: '1.2.3.4' }
          }
        ], relationships: []
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('LAMBDA-001', () => {
    it('flags lambda with overly permissive role', () => {
      const results = lambda001Evaluator.evaluate({
        resources: [
          {
            id: 1, accountId: 1, resourceType: 'LAMBDA', resourceId: 'l1', arn: '', name: '', region: '', status: '',
            attributes: {}
          },
          {
            id: 2, accountId: 1, resourceType: 'IAM_ROLE', resourceId: 'r1', arn: '', name: '', region: '', status: '',
            attributes: {
              policyDocument: { Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] }
            }
          }
        ],
        relationships: [
          { id: 1, accountId: 1, resourceAId: 1, resourceBId: 2, relationType: 'ASSUMES_ROLE' }
        ]
      });
      expect(results).toHaveLength(1);
    });
  });
});
