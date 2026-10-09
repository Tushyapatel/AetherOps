import { getPool } from '../src/database';

async function describeSchema() {
  const pool = getPool();
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('users', 'projects')
    `);
    console.log(res.rows);
  } finally {
    await pool.end();
  }
}
describeSchema();
