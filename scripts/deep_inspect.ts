import { getPool } from '../src/database';

async function inspect() {
  const pool = getPool();
  try {
    console.log('=== risk_scores (all rows) ===');
    const rs = await pool.query('SELECT id, project_id, account_id, analysis_run_id, security_score, cost_score, reliability_score, compliance_score, overall_score, calculated_at FROM risk_scores ORDER BY id');
    console.table(rs.rows);
    console.log(`Total risk_scores: ${rs.rows.length}`);

    console.log('\n=== risk_history (all rows) ===');
    const rh = await pool.query('SELECT id, project_id, account_id, security_score, cost_score, reliability_score, compliance_score, overall_score, recorded_at FROM risk_history ORDER BY id');
    console.table(rh.rows);
    console.log(`Total risk_history: ${rh.rows.length}`);

    console.log('\n=== attack_paths (all rows) ===');
    const ap = await pool.query('SELECT id, account_id, severity, description, finding_chain, analysis_run_id, path_hash FROM attack_paths ORDER BY id');
    for (const row of ap.rows) {
      console.log(`id=${row.id} account=${row.account_id} severity=${row.severity} run=${row.analysis_run_id}`);
      console.log(`  description: ${row.description}`);
      console.log(`  finding_chain: ${JSON.stringify(row.finding_chain)}`);
    }

    console.log('\n=== costs sample (first 5) ===');
    const costs = await pool.query('SELECT id, account_id, service_name, amount, metric FROM costs LIMIT 5');
    console.table(costs.rows);

    console.log('\n=== distinct metric values in costs ===');
    const metrics = await pool.query('SELECT DISTINCT metric, count(*) FROM costs GROUP BY metric');
    console.table(metrics.rows);

  } finally {
    await pool.end();
  }
}
inspect();
