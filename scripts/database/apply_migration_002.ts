import { getPool } from './src/database';
import fs from 'fs';
import path from 'path';

async function run() {
  const p = getPool();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '002_update_costs_schema.sql'), 'utf-8');
    await p.query(sql);
    console.log('Migration 002 applied successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await p.end();
  }
}
run();
