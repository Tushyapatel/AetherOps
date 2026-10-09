import { getPool } from '../src/database';

async function run() {
  const pool = getPool();
  try {
    const tables = [
      'analysis_runs',
      'findings',
      'attack_paths',
      'resources',
      'cloud_accounts',
      'risk_scores',
      'risk_history',
      'recommendations',
      'costs'
    ];
    for (const table of tables) {
      const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
      console.log(`\nTable: ${table}`);
      res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    }
  } finally {
    await pool.end();
  }
}
run();
