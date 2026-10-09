import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

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
    const users = await client.query('SELECT role, COUNT(*) FROM users GROUP BY role');
    console.log('Users by role:', users.rows);
    
    const projects = await client.query('SELECT COUNT(*) FROM projects');
    console.log('Projects:', projects.rows[0].count);
    
    const accounts = await client.query('SELECT COUNT(*) FROM cloud_accounts');
    console.log('Accounts:', accounts.rows[0].count);
    
  } finally {
    await client.end();
  }
}

run().catch(console.error);
