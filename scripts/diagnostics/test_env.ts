
import * as fs from 'fs';
import * as dotenv from 'dotenv';
const envFile = dotenv.parse(fs.readFileSync('.env'));
const envKeys = [envFile.GEMINI_API_KEY_1, envFile.GEMINI_API_KEY_2, envFile.GEMINI_API_KEY_3, envFile.GEMINI_API_KEY_4];
console.log('--- .ENV FILE ON DISK ---');
envKeys.forEach((k, i) => console.log('KEY_' + (i+1) + ' = ' + (k ? 'CONFIGURED' : 'MISSING')));

import { config } from './src/config';
import { getProvider } from './src/modules/ai/ai.service';
const runtimeKeys = [config.ai.geminiApiKey1, config.ai.geminiApiKey2, config.ai.geminiApiKey3, config.ai.geminiApiKey4];
console.log('\n--- BACKEND RUNTIME CONFIG ---');
runtimeKeys.forEach((k, i) => console.log('KEY_' + (i+1) + ' = ' + (k ? 'CONFIGURED' : 'MISSING')));

const present = runtimeKeys.filter(k => !!k);
const uniq = new Set(present);
console.log('\n--- DEDUPLICATION ---\nresult: ' + (present.length === uniq.size ? 'UNIQUE' : 'DUPLICATES FOUND'));

const provider = getProvider() as any;
console.log('\n--- PROVIDER POOL ---');
console.log('configured slots: [' + provider.keySlots.map((s: any) => s.id).join(', ') + ']');
console.log('total: ' + provider.keySlots.length);
console.log('source: backend environment variables');
console.log('backend-only: YES');

import { getPool } from './src/database';
import { runProjectOverview } from './src/modules/ai/ai.service';

async function testLive() {
  const pool = getPool();
  try {
    const res = await pool.query('SELECT id FROM projects LIMIT 1');
    if (res.rows.length > 0) {
      console.log('\n--- LIVE TEST ---');
      try {
        await runProjectOverview(res.rows[0].id, 1);
        console.log('KEY_1: LIVE_SUCCESS');
      } catch (err: any) {
        console.log('KEY_1: ' + (err.code || 'UNKNOWN') + ' - ' + err.message);
      }
    }
  } finally {
    await pool.end();
  }
}
testLive().catch(console.error);

