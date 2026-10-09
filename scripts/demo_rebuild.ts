import { getPool } from '../src/database';
import { createAnalysisRun, updateAnalysisRun } from '../src/api/v1/aws-collector/aws-collector.repository';
import { runSecurityEvaluation } from '../src/modules/security/rules/rule.service';
import { analyzeAttackPaths } from '../src/modules/attack-path/attack-path.service';

async function rebuildDemo() {
  const pool = getPool();
  try {
    console.log('Clearing old analysis runs, findings, attack paths, and risk scores...');
    await pool.query('DELETE FROM attack_paths');
    await pool.query('DELETE FROM findings');
    await pool.query('DELETE FROM analysis_runs');
    await pool.query('DELETE FROM risk_history');
    await pool.query('DELETE FROM risk_scores');
    await pool.query('DELETE FROM recommendations');
    
    const res = await pool.query("SELECT id, project_id, account_id FROM cloud_accounts ORDER BY id");
    const accounts = res.rows;

    for (const acc of accounts) {
      console.log(`\nRebuilding account ${acc.account_id} (ID: ${acc.id})`);
      
      // Create analysis run
      const runId = await createAnalysisRun(acc.project_id.toString(), acc.id);
      
      // Update it to COMPLETED immediately so it can be evaluated
      // Assuming discovery is already done (synthetic resources are present)
      await updateAnalysisRun(runId, 'COMPLETED', 10, ''); // dummy 10 scanned resources

      // Run Security Evaluation
      const evalResult = await runSecurityEvaluation(acc.project_id.toString(), acc.id, runId);
      console.log(`  Security eval: ${evalResult.findingsCreated} findings created.`);

      // Run Attack Path Analysis
      // We pass a dummy user ID '1'
      const apResult = await analyzeAttackPaths(1, parseInt(acc.project_id), acc.id, runId);
      console.log(`  Attack paths: ${apResult.pathsDiscovered} created.`);
    }

  } catch (err: any) {
    console.error('Error rebuilding demo:', err.message);
  } finally {
    await pool.end();
  }
}

rebuildDemo();
