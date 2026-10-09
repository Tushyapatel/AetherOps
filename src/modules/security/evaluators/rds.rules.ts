import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';

export const rds001Evaluator: RuleEvaluator = {
  ruleCode: 'RDS-001',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const instances = context.resources.filter(r => r.resourceType === 'RDS');

    for (const rds of instances) {
      if (rds.attributes?.publiclyAccessible === undefined) {
        continue;
      }
      if (rds.attributes.publiclyAccessible === true) {
        results.push({
          ruleCode: 'RDS-001',
          resourceId: rds.id,
          severity: 'HIGH',
          status: 'OPEN',
          note: 'RDS instance is publicly accessible.'
        });
      }
    }
    return results;
  }
};

export const rds002Evaluator: RuleEvaluator = {
  ruleCode: 'RDS-002',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const instances = context.resources.filter(r => r.resourceType === 'RDS');

    for (const rds of instances) {
      if (rds.attributes?.storageEncrypted === undefined) {
        continue;
      }
      if (rds.attributes.storageEncrypted === false) {
        results.push({
          ruleCode: 'RDS-002',
          resourceId: rds.id,
          severity: 'MEDIUM',
          status: 'OPEN',
          note: 'RDS instance storage encryption is disabled.'
        });
      }
    }
    return results;
  }
};
