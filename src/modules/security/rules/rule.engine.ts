import { EvaluationContext, EvaluationResult, RuleEvaluator } from './rule.types';
import { sg001Evaluator } from '../evaluators/security-group.rules';
import { s3001Evaluator, s3002Evaluator } from '../evaluators/s3.rules';
import { iam001Evaluator, iam002Evaluator, iam003Evaluator } from '../evaluators/iam.rules';
import { rds001Evaluator, rds002Evaluator } from '../evaluators/rds.rules';
import { ec2001Evaluator } from '../evaluators/ec2.rules';
import { lambda001Evaluator } from '../evaluators/lambda.rules';

const evaluators: Record<string, RuleEvaluator> = {
  'SG-001': sg001Evaluator,
  'S3-001': s3001Evaluator,
  'S3-002': s3002Evaluator,
  'IAM-001': iam001Evaluator,
  'IAM-002': iam002Evaluator,
  'IAM-003': iam003Evaluator,
  'RDS-001': rds001Evaluator,
  'RDS-002': rds002Evaluator,
  'EC2-001': ec2001Evaluator,
  'LAMBDA-001': lambda001Evaluator,
};

export function evaluateRules(
  enabledRuleCodes: string[],
  context: EvaluationContext
): EvaluationResult[] {
  let allResults: EvaluationResult[] = [];

  for (const ruleCode of enabledRuleCodes) {
    const evaluator = evaluators[ruleCode];
    if (evaluator) {
      try {
        const results = evaluator.evaluate(context);
        allResults = allResults.concat(results);
      } catch (err) {
        console.error(`Error evaluating rule ${ruleCode}:`, err);
      }
    }
  }

  return allResults;
}
