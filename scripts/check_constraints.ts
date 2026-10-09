import { getPool } from '../src/database';
async function run() {
  const pool = getPool();
  try {
    const res1 = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname IN ('risk_scores', 'risk_history')
    `);
    console.log(res1.rows);
  } finally {
    pool.end();
  }
}
run();
