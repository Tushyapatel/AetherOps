import { getEnabledRules, getAccountResources, getAccountRelationships, persistFindings } from './rule.repository';
import { evaluateRules } from './rule.engine';
import { logger } from '../../../logger';
import { getPool } from '../../../database';

export async function runSecurityEvaluation(
  projectId: number,
  accountId: number,
  analysisRunId: number
): Promise<{ evaluatedRules: string[]; findingsCreated: number; findingsUpdated: number; findingsResolved: number }> {
  // We assume verify logic (project ownership, account ownership) is done in the controller/middleware

  // 1. Load enabled rules
  const allRules = await getEnabledRules();
  const enabledRuleCodes = allRules.filter(r => r.enabled).map(r => r.ruleCode);
  
  if (enabledRuleCodes.length === 0) {
    logger.warn(`No enabled security rules found for evaluation run ${analysisRunId}.`);
    return { evaluatedRules: [], findingsCreated: 0, findingsUpdated: 0, findingsResolved: 0 };
  }

  // Write STARTED audit log
  await getPool().query(
    `INSERT INTO audit_logs (project_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, 'SECURITY_EVALUATION_STARTED', 'ANALYSIS_RUN', $2, $3, CURRENT_TIMESTAMP)`,
    [
      projectId,
      analysisRunId,
      JSON.stringify({ accountId, evaluatedRulesCount: enabledRuleCodes.length })
    ]
  );

  // 2. Load resources & relationships
  const resources = await getAccountResources(accountId);
  const relationships = await getAccountRelationships(accountId);

  const context = { resources, relationships };

  // 3. Evaluate rules
  const results = evaluateRules(enabledRuleCodes, context);

  // 4. Persist findings (Idempotently)
  const stats = await persistFindings(accountId, analysisRunId, results);

  logger.info(`Security evaluation completed for run ${analysisRunId}`, {
    accountId,
    projectId,
    evaluatedRulesCount: enabledRuleCodes.length,
    ...stats
  });

  // Write COMPLETED audit log
  await getPool().query(
    `INSERT INTO audit_logs (project_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, 'SECURITY_EVALUATION_COMPLETED', 'ANALYSIS_RUN', $2, $3, CURRENT_TIMESTAMP)`,
    [
      projectId,
      analysisRunId,
      JSON.stringify({ accountId, evaluatedRules: enabledRuleCodes, ...stats })
    ]
  );

  return { evaluatedRules: enabledRuleCodes, ...stats };
}
