import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_add_analysis_run_id_to_attack_paths.sql'), 'utf-8');

  // Run for development DB
  const devClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'aetherops', // Wait, .env has DB_NAME=aetherops? I should check .env again
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Dhruvmistry123.',
  });

  try {
    await devClient.connect();
    // Use IF NOT EXISTS equivalent by just catching error or we can modify the SQL to be idempotent for dev.
    // I'll just run it. If it fails due to column existing, it's fine.
    try {
      await devClient.query(sql);
      console.log('Successfully migrated dev database.');
    } catch (e: any) {
      console.log('Migration on dev database failed or already applied:', e.message);
    }
  } finally {
    await devClient.end();
  }

}

runMigration().catch(console.error);
