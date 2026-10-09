import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';

async function run() {
  const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
  });
  await client.connect();
  try {
    const res = await client.query(`SELECT id, email, role, status FROM users WHERE role = 'PLATFORM_ADMIN'`);
    if (res.rows.length > 0) {
      console.log('Platform admin user:', res.rows[0]);
      const hashed = await bcrypt.hash('Test1234!', 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashed, res.rows[0].email]);
      console.log('Updated password to Test1234!');
    } else {
      console.log('No platform admin found');
    }
  } finally {
    await client.end();
  }
}

run().catch(console.error);
