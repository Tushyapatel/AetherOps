const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aetherops',
  user: 'postgres',
  password: 'Dhruvmistry123.'
});

async function run() {
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);
  
  for (const row of tables.rows) {
    console.log(`\nTable: ${row.table_name}`);
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [row.table_name]);
    console.table(cols.rows);
  }
  pool.end();
}
run();
