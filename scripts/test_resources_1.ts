import { getPool } from '../src/database';

async function r() {
  const p = getPool();
  try {
    const res = await p.query("SELECT id, account_id, resource_type, attributes FROM resources WHERE account_id = 1 AND resource_type = 'S3'");
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await p.end();
  }
}
r();
