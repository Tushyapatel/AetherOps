import { getPool } from './src/database';
import { config } from 'dotenv';
config();

async function run() {
  const pool = getPool();
  try {
    const users = await pool.query('SELECT role, COUNT(*) FROM users GROUP BY role');
    console.log('Users by role:', users.rows);
    
    const projects = await pool.query('SELECT COUNT(*) FROM projects');
    console.log('Projects:', projects.rows[0].count);
    
    const accounts = await pool.query('SELECT COUNT(*) FROM cloud_accounts');
    console.log('Accounts:', accounts.rows[0].count);
    
  } finally {
    process.exit(0);
  }
}

run().catch(console.error);
