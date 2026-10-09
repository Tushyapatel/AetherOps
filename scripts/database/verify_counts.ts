import { getPool } from './src/database';
import { config } from 'dotenv';
config();

async function verifyCounts() {
  const pool = getPool();
  try {
    const cloudAccounts = await pool.query('SELECT count(*) FROM cloud_accounts');
    const resources = await pool.query('SELECT count(*) FROM resources');
    const relationships = await pool.query('SELECT count(*) FROM relationships');
    console.log('Cloud Accounts:', cloudAccounts.rows[0].count);
    console.log('Resources:', resources.rows[0].count);
    console.log('Relationships:', relationships.rows[0].count);
  } finally {
    await pool.end();
  }
}
verifyCounts().catch(console.error);
