import { getPool } from '../../database';
import { AttackPath } from './attack-path.types';

export async function saveAttackPaths(
  accountId: number,
  analysisRunId: number,
  paths: AttackPath[]
): Promise<number> {
  if (paths.length === 0) return 0;

  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const queryText = `
      INSERT INTO attack_paths (account_id, analysis_run_id, path_hash, severity, finding_chain, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (analysis_run_id, path_hash) DO NOTHING
      RETURNING id
    `;

    let insertedCount = 0;
    for (const path of paths) {
      const res = await client.query(queryText, [
        accountId,
        analysisRunId,
        path.pathHash,
        path.severity || 'HIGH',
        JSON.stringify(path.findingChain),
        path.description || 'Attack Path discovered',
      ]);
      if (res.rowCount && res.rowCount > 0) {
        insertedCount++;
      }
    }

    await client.query('COMMIT');
    return insertedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getResourcesForAccount(accountId: number): Promise<any[]> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM resources WHERE account_id = $1', [accountId]);
  return res.rows;
}

export async function getRelationshipsForAccount(accountId: number): Promise<any[]> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM relationships WHERE account_id = $1', [accountId]);
  return res.rows;
}

export async function getFindingsForAccount(accountId: number, analysisRunId: number): Promise<any[]> {
  const pool = getPool();
  const res = await pool.query(
    "SELECT * FROM findings WHERE account_id = $1 AND status = 'OPEN' AND analysis_run_id = $2",
    [accountId, analysisRunId]
  );
  return res.rows;
}

export async function checkAnalysisRunOwnership(
  userId: number,
  projectId: number,
  cloudAccountId: number,
  analysisRunId: number
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT a.id 
     FROM analysis_runs a
     JOIN projects p ON a.project_id = p.id
     WHERE a.id = $1 
       AND a.project_id = $2 
       AND a.account_id = $3
       AND p.user_id = $4`,
    [analysisRunId, projectId, cloudAccountId, userId]
  );
  return res.rows.length > 0;
}
