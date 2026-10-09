import { getPool, connectDb } from './src/database';

async function run() {
  await connectDb();
  const res = await getPool().query('SELECT * FROM resources LIMIT 5');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
