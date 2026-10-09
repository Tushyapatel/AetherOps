import { getPool, connectDb } from './src/database';

async function run() {
  await connectDb();
  const pool = getPool();
  const res = await pool.query(`SELECT attributes FROM resources WHERE resource_type = 'S3' LIMIT 5`);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
