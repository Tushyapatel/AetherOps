import { getPool } from './src/database';
import { hashPassword } from './src/api/v1/auth/auth.service';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = getPool();
  try {
    const res = await pool.query(`SELECT id, email, role, status FROM users WHERE role = 'PLATFORM_ADMIN'`);
    if (res.rows.length > 0) {
      console.log('Platform admin user:', res.rows[0]);
      const hashed = await hashPassword('Test1234!');
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashed, res.rows[0].email]);
      console.log('Updated password to Test1234!');
    } else {
      console.log('No platform admin found');
    }
  } finally {
    process.exit(0);
  }
}

run();
