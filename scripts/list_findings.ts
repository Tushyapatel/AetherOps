import { getPool } from '../src/database';

async function r() {
  const p = getPool();
  try {
    const res = await p.query(`
      SELECT f.account_id, c.account_name, f.rule_id, f.severity 
      FROM findings f
      JOIN cloud_accounts c ON f.account_id = c.id
      ORDER BY f.account_id, f.rule_id
    `);
    console.table(res.rows);
  } finally {
    await p.end();
  }
}
r();
