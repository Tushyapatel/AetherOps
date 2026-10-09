import { getPool } from '../src/database';

async function checkOrphans() {
  const pool = getPool();
  try {
    const checks = [
      { tbl: 'resources', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'relationships', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'analysis_runs', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'findings', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'findings', fk: 'analysis_run_id', ref: 'analysis_runs' },
      { tbl: 'risk_scores', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'risk_scores', fk: 'analysis_run_id', ref: 'analysis_runs' },
      { tbl: 'risk_history', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'attack_paths', fk: 'account_id', ref: 'cloud_accounts' },
      { tbl: 'attack_paths', fk: 'analysis_run_id', ref: 'analysis_runs' },
      { tbl: 'recommendations', fk: 'finding_id', ref: 'findings' },
      { tbl: 'costs', fk: 'account_id', ref: 'cloud_accounts' },
    ];
    let hasOrphans = false;
    for (const c of checks) {
      const res = await pool.query(`SELECT COUNT(*) FROM ${c.tbl} WHERE ${c.fk} NOT IN (SELECT id FROM ${c.ref})`);
      const count = parseInt(res.rows[0].count);
      if (count > 0) {
        console.log(`Orphans found in ${c.tbl} missing ${c.ref} (${c.fk}): ${count}`);
        hasOrphans = true;
      }
    }
    if (!hasOrphans) {
      console.log('No orphans found. DB Integrity PASS');
    }
  } finally {
    pool.end();
  }
}
checkOrphans();
