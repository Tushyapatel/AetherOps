import { getPool } from '../src/database';

async function run() {
  const pool = getPool();
  try {
    console.log('--- Phase 17 Verification Gate ---');

    // Check project mapping
    const projects = await pool.query(`SELECT id, name, user_id FROM projects ORDER BY id`);
    const accs = await pool.query(`SELECT account_id, account_name, project_id FROM cloud_accounts`);
    
    console.log('\\n[VERIFY PROJECT / CLOUD ACCOUNT MAPPING]');
    for (const p of projects.rows) {
      console.log(`Project: ${p.name} (ID: ${p.id})`);
      const pAccs = accs.rows.filter(a => String(a.project_id) === String(p.id));
      pAccs.forEach(a => {
        console.log(`  - AWS Account: ${a.account_name} (ID: ${a.account_id})`);
      });
    }

    // Check data integrity counts
    console.log('\\n[DATA INTEGRITY]');
    const tableCounts = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM cloud_accounts`),
      pool.query(`SELECT COUNT(*) FROM resources`),
      pool.query(`SELECT COUNT(*) FROM relationships`),
      pool.query(`SELECT COUNT(*) FROM findings`),
      pool.query(`SELECT COUNT(*) FROM attack_paths`),
      pool.query(`SELECT COUNT(*) FROM recommendations`),
      pool.query(`SELECT COUNT(*) FROM costs`),
      pool.query(`SELECT COUNT(*) FROM risk_scores`),
      pool.query(`SELECT COUNT(*) FROM risk_history`),
      pool.query(`SELECT COUNT(*) FROM analysis_runs`),
    ]);
    const counts = tableCounts.map(r => parseInt(r.rows[0].count));
    console.log(`cloud_accounts: ${counts[0]} (Expected 10)`);
    console.log(`resources: ${counts[1]} (Expected 177)`);
    console.log(`relationships: ${counts[2]} (Expected 181)`);
    console.log(`findings: ${counts[3]}`);
    console.log(`attack_paths: ${counts[4]}`);
    console.log(`recommendations: ${counts[5]}`);
    console.log(`costs: ${counts[6]}`);
    console.log(`risk_scores: ${counts[7]}`);
    console.log(`risk_history: ${counts[8]}`);
    console.log(`analysis_runs: ${counts[9]}`);

    // End
  } finally {
    await pool.end();
  }
}

run();
