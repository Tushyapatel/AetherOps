import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';

export const ec2001Evaluator: RuleEvaluator = {
  ruleCode: 'EC2-001',
  evaluate: (_context: EvaluationContext): EvaluationResult[] => {
    // Phase 6 does not currently collect LoadBalancer or WAF data.
    // Thus we cannot conclusively prove the absence of a WAF/LB relationship.
    // Returning an empty array to avoid false positives.
    return [];
  }
};
