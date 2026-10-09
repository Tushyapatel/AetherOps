import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';

export const iam001Evaluator: RuleEvaluator = {
  ruleCode: 'IAM-001',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const users = context.resources.filter(r => r.resourceType === 'IAM_USER');

    for (const user of users) {
      const attrs = user.attributes as { mfaEnabled?: boolean };
      if (attrs.mfaEnabled === undefined) {
        continue;
      }
      if (attrs.mfaEnabled === false) {
        results.push({
          ruleCode: 'IAM-001',
          resourceId: user.id,
          severity: 'HIGH',
          status: 'OPEN',
          note: 'IAM user does not have MFA enabled.'
        });
      }
    }
    return results;
  }
};

export const iam002Evaluator: RuleEvaluator = {
  ruleCode: 'IAM-002',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const accessKeys = context.resources.filter(r => r.resourceType === 'IAM_ACCESS_KEY');

    for (const key of accessKeys) {
      const attrs = key.attributes as { createDate?: string | Date; lastUsedDate?: string | Date; ageDays?: number; lastUsedDays?: number };
      if (attrs.createDate === undefined && attrs.lastUsedDate === undefined && attrs.ageDays === undefined) {
        continue;
      }

      let isOld = false;

      if (attrs.ageDays !== undefined && attrs.ageDays > 90) {
        isOld = true;
      } else if (attrs.createDate) {
        const createDate = new Date(attrs.createDate);
        const ageDays = (Date.now() - createDate.getTime()) / (1000 * 3600 * 24);
        if (ageDays > 90) {
          isOld = true;
        }
      }

      if (attrs.lastUsedDays !== undefined && attrs.lastUsedDays > 90) {
        isOld = true;
      } else if (attrs.lastUsedDate) {
        const lastUsed = new Date(attrs.lastUsedDate);
        const unusedDays = (Date.now() - lastUsed.getTime()) / (1000 * 3600 * 24);
        if (unusedDays > 90) {
          isOld = true;
        }
      }

      if (isOld) {
        results.push({
          ruleCode: 'IAM-002',
          resourceId: key.id,
          severity: 'MEDIUM',
          status: 'OPEN',
          note: 'IAM access key is older than 90 days or unused for 90 days.'
        });
      }
    }
    return results;
  }
};

export const iam003Evaluator: RuleEvaluator = {
  ruleCode: 'IAM-003',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const roles = context.resources.filter(r => r.resourceType === 'IAM_ROLE' || r.resourceType === 'IAM_POLICY');

    for (const role of roles) {
      const attrs = role.attributes as { policyDocument?: unknown };
      const policyDocument = attrs.policyDocument;
      
      if (!policyDocument) {
        continue;
      }

      let isAdmin = false;
      
      // Parse if it's a string, otherwise it's an object
      let parsedDoc: any = policyDocument;
      if (typeof policyDocument === 'string') {
        try {
          parsedDoc = JSON.parse(policyDocument);
        } catch {
          continue; // Malformed JSON
        }
      }

      if (parsedDoc && parsedDoc.Statement) {
        const statements = Array.isArray(parsedDoc.Statement) ? parsedDoc.Statement : [parsedDoc.Statement];
        for (const stmt of statements) {
          if (stmt.Effect === 'Allow') {
            const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
            const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
            
            if (actions.includes('*') && resources.includes('*')) {
              isAdmin = true;
              break;
            }
          }
        }
      }

      if (isAdmin) {
        results.push({
          ruleCode: 'IAM-003',
          resourceId: role.id,
          severity: 'HIGH',
          status: 'OPEN',
          note: 'IAM policy grants administrator-level permissions (* on *).'
        });
      }
    }
    return results;
  }
};
