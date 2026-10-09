import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';
import { iam003Evaluator } from './iam.rules';

export const lambda001Evaluator: RuleEvaluator = {
  ruleCode: 'LAMBDA-001',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    
    // First, find IAM roles that are overly permissive (using logic from IAM-003)
    // Wait, IAM-003 evaluator returns results for the IAM_ROLE resource.
    const iamResults = iam003Evaluator.evaluate(context);
    const overlyPermissiveRoleIds = new Set(iamResults.map(r => r.resourceId));

    const lambdas = context.resources.filter(r => r.resourceType === 'LAMBDA');

    for (const lambda of lambdas) {
      // Find the ASSUMES_ROLE relationship
      const assumeRel = context.relationships.find(
        rel => rel.resourceAId === lambda.id && rel.relationType === 'ASSUMES_ROLE'
      );

      if (assumeRel) {
        if (overlyPermissiveRoleIds.has(assumeRel.resourceBId)) {
          results.push({
            ruleCode: 'LAMBDA-001',
            resourceId: lambda.id,
            severity: 'MEDIUM',
            status: 'OPEN',
            note: 'Lambda function uses an overly permissive IAM execution role.'
          });
        }
      } else if (lambda.attributes?.role) {
        // Fallback: If relationship is missing but we have the role ARN in attributes, try to map it
        const roleArn = lambda.attributes.role;
        const linkedRole = context.resources.find(r => r.arn === roleArn);
        if (linkedRole && overlyPermissiveRoleIds.has(linkedRole.id)) {
          results.push({
            ruleCode: 'LAMBDA-001',
            resourceId: lambda.id,
            severity: 'MEDIUM',
            status: 'OPEN',
            note: 'Lambda function uses an overly permissive IAM execution role.'
          });
        }
      }
    }
    
    return results;
  }
};
