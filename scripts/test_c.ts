import { getPool } from '../src/database';
import { createAnalysisRun, updateAnalysisRun } from '../src/api/v1/aws-collector/aws-collector.repository';
import { runSecurityEvaluation } from '../src/modules/security/rules/rule.service';
import { analyzeAttackPaths } from '../src/modules/attack-path/attack-path.service';

async function runTestC() {
  const pool = getPool();
  try {
    const res = await pool.query("SELECT id, project_id, account_id FROM cloud_accounts WHERE project_id = 1 ORDER BY id");
    const accounts = res.rows;

    for (const acc of accounts) {
      console.log(`\nCreating NEW run for account ${acc.account_id} (ID: ${acc.id})`);
      
      const runId = await createAnalysisRun(acc.project_id.toString(), acc.id);
      await updateAnalysisRun(runId, 'COMPLETED', 10, ''); 

      const evalResult = await runSecurityEvaluation(acc.project_id.toString(), acc.id, runId);
      console.log(`  Security eval: ${evalResult.findingsCreated} findings created.`);

      const apResult = await analyzeAttackPaths(1, parseInt(acc.project_id), acc.id, runId);
      console.log(`  Attack paths: ${apResult.pathsDiscovered} created.`);
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

runTestC();
