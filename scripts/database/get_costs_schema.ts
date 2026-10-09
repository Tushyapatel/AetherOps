import { getPool } from './src/database';

async function run() {
  const p = getPool();
  try {
    const res = await p.query(`SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'costs'::regclass`);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await p.end();
  }
}
run();
