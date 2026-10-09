require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'atherops',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});
(async () => {
  try {
    const res = await pool.query(`
      SELECT p.id as project_id, c.id as cloud_account_id, c.mode, c.provider, c.region,
             (SELECT COUNT(*) FROM resources r WHERE r.account_id = c.id) as resource_count,
             (SELECT COUNT(*) FROM relationships rel JOIN resources r ON rel.resource_a_id = r.id WHERE r.account_id = c.id) as relationship_count,
             (SELECT COUNT(*) FROM analysis_runs a WHERE a.project_id = p.id) as analysis_count,
             (SELECT COUNT(*) FROM findings f WHERE f.account_id = c.id) as findings_count,
             (SELECT COUNT(*) FROM costs costs WHERE costs.account_id = c.id) as cost_count
      FROM projects p
      JOIN cloud_accounts c ON p.id = c.project_id
      WHERE c.id = 13
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
})();
