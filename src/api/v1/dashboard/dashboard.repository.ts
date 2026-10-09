import { getPool } from '../../../database';

export async function getProjectRiskScores(projectId: number) {
  const pool = getPool();
  // Aggregate the latest risk score across all accounts for this project
  const res = await pool.query(`
    SELECT
      ROUND(AVG(rs.overall_score))    AS overall_score,
      ROUND(AVG(rs.security_score))   AS security_score,
      ROUND(AVG(rs.cost_score))       AS cost_score,
      ROUND(AVG(rs.reliability_score)) AS reliability_score,
      ROUND(AVG(rs.compliance_score)) AS compliance_score,
      MAX(rs.calculated_at)           AS calculated_at
    FROM risk_scores rs
    WHERE rs.project_id = $1
      AND rs.account_id > 0
  `, [projectId]);
  const row = res.rows[0];
  if (!row || row.overall_score === null) return null;
  return row;
}

export async function getProjectRiskHistory(projectId: number) {
  const pool = getPool();
  const res = await pool.query(`
    SELECT
      recorded_at,
      ROUND(AVG(security_score))   AS security_score,
      ROUND(AVG(overall_score))    AS overall_score,
      ROUND(AVG(reliability_score)) AS reliability_score
    FROM risk_history
    WHERE project_id = $1
    GROUP BY recorded_at
    ORDER BY recorded_at ASC
  `, [projectId]);
  return res.rows;
}

export async function getProjectFindings(projectId: number) {
  const pool = getPool();
  const res = await pool.query(`
    SELECT f.*, r.name as resource_name, r.resource_type as resource_type, c.account_name as cloud_account_name, c.id as cloud_account_id
    FROM findings f
    JOIN analysis_runs ar ON f.analysis_run_id = ar.id
    JOIN cloud_accounts c ON ar.account_id = c.id
    LEFT JOIN resources r ON f.resource_id = r.id
    WHERE c.project_id = $1
    ORDER BY 
      CASE f.severity 
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END ASC, f.created_at DESC
  `, [projectId]);
  return res.rows;
}

export async function getProjectResources(projectId: number) {
  const pool = getPool();
  const res = await pool.query(`
    SELECT r.*, c.account_name as cloud_account_name, c.id as cloud_account_id
    FROM resources r
    JOIN cloud_accounts c ON r.account_id = c.id
    WHERE c.project_id = $1
    ORDER BY r.created_at DESC
  `, [projectId]);
  return res.rows;
}

export async function getProjectAttackPaths(projectId: number) {
  const pool = getPool();
  const res = await pool.query(`
    WITH LatestRuns AS (
      SELECT account_id, MAX(id) as max_run_id
      FROM analysis_runs
      WHERE status = 'COMPLETED'
      GROUP BY account_id
    )
    SELECT ap.*, c.account_name as cloud_account_name, c.id as cloud_account_id
    FROM attack_paths ap
    JOIN analysis_runs ar ON ap.analysis_run_id = ar.id
    JOIN LatestRuns lr ON ar.account_id = lr.account_id AND ar.id = lr.max_run_id
    JOIN cloud_accounts c ON ar.account_id = c.id
    WHERE c.project_id = $1
    ORDER BY ap.created_at DESC
  `, [projectId]);
  return res.rows;
}

export async function getProjectCosts(projectId: number) {
  const pool = getPool();
  const res = await pool.query(`
    SELECT costs.*, c.account_name as cloud_account_name
    FROM costs
    JOIN cloud_accounts c ON costs.account_id = c.id
    WHERE c.project_id = $1
    ORDER BY costs.period_start ASC, costs.service_name ASC
  `, [projectId]);
  return res.rows;
}
