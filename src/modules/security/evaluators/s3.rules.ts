import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';

export const s3001Evaluator: RuleEvaluator = {
  ruleCode: 'S3-001',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const buckets = context.resources.filter(r => r.resourceType === 'S3');

    for (const bucket of buckets) {
      const attrs = bucket.attributes as { publicAccessBlock?: { BlockPublicAcls?: boolean, BlockPublicPolicy?: boolean }, acl?: { Grants?: Array<{ Grantee?: { URI?: string }, Permission?: string }> }, bucketPolicy?: { Statement?: Array<{ Effect?: string, Principal?: string }> }, isPublic?: boolean };
      const publicAccessBlock = attrs.publicAccessBlock;
      const acl = attrs.acl;
      const policy = attrs.bucketPolicy;

      // Ensure we have at least SOME data to evaluate
      if (publicAccessBlock === undefined && acl === undefined && policy === undefined) {
        continue; // Unsupported or missing data
      }

      let isPublic = false;

      if (publicAccessBlock) {
        if (publicAccessBlock.BlockPublicAcls === false || publicAccessBlock.BlockPublicPolicy === false) {
          // It's possible to be public, but we need concrete evidence it IS public
          // We will look at ACL or Policy for concrete evidence
        }
      }

      if (acl && acl.Grants) {
        for (const grant of acl.Grants) {
          if (grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' || 
              grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers') {
            if (grant.Permission === 'READ' || grant.Permission === 'WRITE' || grant.Permission === 'FULL_CONTROL') {
              isPublic = true;
            }
          }
        }
      }

      if (policy && policy.Statement) {
        for (const stmt of policy.Statement) {
          if (stmt.Effect === 'Allow' && stmt.Principal === '*') {
            isPublic = true;
          }
        }
      }

      // Sometimes just `isPublic: true` is explicitly stored in demo data
      if (attrs.isPublic === true) {
        isPublic = true;
      }

      if (isPublic) {
        results.push({
          ruleCode: 'S3-001',
          resourceId: bucket.id,
          severity: 'HIGH',
          status: 'OPEN',
          note: 'S3 bucket is explicitly publicly readable or writable.'
        });
      }
    }
    return results;
  }
};

export const s3002Evaluator: RuleEvaluator = {
  ruleCode: 'S3-002',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const buckets = context.resources.filter(r => r.resourceType === 'S3');

    for (const bucket of buckets) {
      const attrs = bucket.attributes as {
        encryption?: { ServerSideEncryptionConfiguration?: { Rules: any[] }, enabled?: boolean, type?: string },
        encryptionEnabled?: boolean
      };
      const encryption = attrs.encryption;
      
      // If we don't have the encryption field at all, we don't infer it as insecure.
      if (encryption === undefined && attrs.encryptionEnabled === undefined) {
        continue;
      }

      let hasEncryption = true;
      if (attrs.encryptionEnabled === false) {
        hasEncryption = false;
      } else if (attrs.encryptionEnabled === true) {
        hasEncryption = true;
      } else if (encryption !== undefined) {
        // Check demo-data shape: { enabled: true, type: 'AES256' }
        if (encryption.enabled === true || encryption.type) {
          hasEncryption = true;
        } else if (encryption.ServerSideEncryptionConfiguration) {
          hasEncryption = encryption.ServerSideEncryptionConfiguration.Rules.length > 0;
        } else {
          hasEncryption = false;
        }
      }

      if (!hasEncryption) {
        results.push({
          ruleCode: 'S3-002',
          resourceId: bucket.id,
          severity: 'MEDIUM',
          status: 'OPEN',
          note: 'S3 bucket has server-side encryption disabled.'
        });
      }
    }
    return results;
  }
};
