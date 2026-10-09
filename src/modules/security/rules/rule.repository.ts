import { getPool } from '../../../database';
import { DbResource, DbRelationship, SecurityRule, EvaluationResult } from './rule.types';

export async function getEnabledRules(): Promise<SecurityRule[]> {
  const result = await getPool().query<{ ruleCode: string, name: string, category: string, severity: 'HIGH'|'MEDIUM'|'LOW'|'CRITICAL', description: string, remediationTemplate?: string, enabled: boolean }>(
    `SELECT rule_code as "ruleCode", name, category, severity, description, remediation_template as "remediationTemplate", enabled
     FROM finding_rules WHERE enabled = true`
  );
  return result.rows;
}

export async function getAccountResources(accountId: number): Promise<DbResource[]> {
  const result = await getPool().query<DbResource>(
    `SELECT id, account_id as "accountId", resource_type as "resourceType", resource_id as "resourceId",
            arn, name, region, status, attributes
     FROM resources WHERE account_id = $1`,
    [accountId]
  );
  return result.rows;
}

export async function getAccountRelationships(accountId: number): Promise<DbRelationship[]> {
  const result = await getPool().query<DbRelationship>(
    `SELECT id, account_id as "accountId", resource_a_id as "resourceAId", resource_b_id as "resourceBId",
            relation_type as "relationType"
     FROM relationships WHERE account_id = $1`,
    [accountId]
  );
  return result.rows;
}

export async function persistFindings(
  accountId: number,
  analysisRunId: number,
  results: EvaluationResult[]
): Promise<{ findingsCreated: number; findingsUpdated: number; findingsResolved: number }> {
  const pool = getPool();
  let findingsCreated = 0;
  let findingsUpdated = 0;
  let findingsResolved = 0;

  // Get all existing findings for this account
  const existingResult = await pool.query<{ id: number, resource_id: number | string, rule_id: string, status: string }>(
    `SELECT id, resource_id, rule_id, status FROM findings WHERE account_id = $1`,
    [accountId]
  );
  
  const existingFindingsMap = new Map<string, { id: number, resource_id: number | string, rule_id: string, status: string }>(); 
  for (const row of existingResult.rows) {
    existingFindingsMap.set(`${row.resource_id}_${row.rule_id}`, row);
  }

  const currentOpenFindings = new Set<string>();

  for (const res of results) {
    if (res.status !== 'OPEN') continue;
    
    const key = `${res.resourceId}_${res.ruleCode}`;
    currentOpenFindings.add(key);

    const existing = existingFindingsMap.get(key);
    if (existing) {
      await pool.query(
        `UPDATE findings 
         SET status = 'OPEN', severity = $1, note = $2, analysis_run_id = $3, resolved_at = NULL
         WHERE id = $4`,
        [res.severity, res.note || null, analysisRunId, existing.id]
      );
      if (existing.status !== 'OPEN') {
        // Re-opened
        findingsCreated++; 
      } else {
        findingsUpdated++;
      }
    } else {
      await pool.query(
        `INSERT INTO findings (account_id, resource_id, rule_id, severity, status, note, analysis_run_id, created_at)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, CURRENT_TIMESTAMP)`,
        [accountId, res.resourceId, res.ruleCode, res.severity, res.note || null, analysisRunId]
      );
      findingsCreated++;
    }
  }

  for (const [key, existing] of existingFindingsMap.entries()) {
    if (existing.status === 'OPEN' && !currentOpenFindings.has(key)) {
      await pool.query(
        `UPDATE findings 
         SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, analysis_run_id = $1
         WHERE id = $2`,
        [analysisRunId, existing.id]
      );
      findingsResolved++;
    }
  }

  await pool.query(
    `UPDATE analysis_runs 
     SET findings_created = $2
     WHERE id = $1`,
    [analysisRunId, findingsCreated]
  );

  return { findingsCreated, findingsUpdated, findingsResolved };
}
