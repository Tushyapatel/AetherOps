import { getPool } from '../src/database';

async function listUsers() {
  const pool = getPool();
  try {
    const res = await pool.query('SELECT * FROM users');
    console.log('USERS:', res.rows);
    const res2 = await pool.query('SELECT * FROM projects');
    console.log('PROJECTS:', res2.rows);
  } finally {
    await pool.end();
  }
}
listUsers();
