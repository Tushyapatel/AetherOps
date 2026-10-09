import { getPool } from '../src/database';

async function r() {
  const p = getPool();
  try {
    const res = await p.query("SELECT distinct resource_type FROM resources");
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await p.end();
  }
}
r();
