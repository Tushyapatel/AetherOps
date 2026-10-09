const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aetherops',
  user: 'postgres',
  password: 'Dhruvmistry123.'
});

async function run() {
  const tableNames = ['users', 'projects', 'cloud_accounts', 'resources', 'relationships', 'findings', 'finding_rules', 'analysis_runs', 'audit_logs'];
  
  for (const table of tableNames) {
    console.log(`\nTable: ${table}`);
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    console.table(cols.rows);
  }
  pool.end();
}
run();
