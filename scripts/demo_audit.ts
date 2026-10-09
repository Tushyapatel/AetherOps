import { getPool } from '../src/database';

async function run() {
  const pool = getPool();
  const tables = [
    'projects',
    'cloud_accounts',
    'resources',
    'relationships',
    'analysis_runs',
    'findings',
    'risk_scores',
    'risk_history',
    'recommendations',
    'costs',
    'attack_paths'
  ];

  console.log('--- DATABASE COUNTS ---');
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT count(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    } catch (err: any) {
      console.log(`${table}: ERROR - ${err.message}`);
    }
  }
  await pool.end();
}

run();
