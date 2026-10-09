import { getPool } from '../src/database';

async function getCounts() {
  const pool = getPool();
  try {
    const tables = ['projects', 'cloud_accounts', 'resources', 'relationships', 'analysis_runs', 'findings', 'risk_scores', 'risk_history', 'attack_paths', 'recommendations', 'costs'];
    const counts: Record<string, number> = {};
    for (const tbl of tables) {
      const res = await pool.query(`SELECT COUNT(*) FROM ${tbl}`);
      counts[tbl] = parseInt(res.rows[0].count);
    }
    console.log('=== Database Counts ===');
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n=== Per Account Details ===');
    const perAccount = await pool.query(`
      SELECT 
        ca.id as account_id,
        (SELECT COUNT(*) FROM risk_scores rs WHERE rs.account_id = ca.id) as risk_scores_count,
        (SELECT COUNT(*) FROM risk_history rh WHERE rh.account_id = ca.id) as risk_history_count,
        (SELECT COUNT(*) FROM analysis_runs ar WHERE ar.account_id = ca.id) as analysis_runs_count
      FROM cloud_accounts ca
      ORDER BY ca.id
    `);
    console.table(perAccount.rows);
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await pool.end();
  }
}

getCounts();
