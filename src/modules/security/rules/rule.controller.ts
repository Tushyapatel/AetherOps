import { Request, Response } from 'express';
import { runSecurityEvaluation } from './rule.service';
import { logger } from '../../../logger';
import { getPool } from '../../../database';

export async function evaluateAnalysisRunController(req: Request, res: Response): Promise<void> {
  const projectId = BigInt(String(req.params.projectId));
  const cloudAccountId = parseInt(String(req.params.cloudAccountId), 10);
  const analysisRunId = parseInt(String(req.params.analysisRunId), 10);
  const userId = req.user?.id; // from requireAuth

  if (isNaN(cloudAccountId) || isNaN(analysisRunId) || !projectId) {
    res.status(400).json({ error: 'Invalid ID parameters' });
    return;
  }

  try {
    // Verify project ownership
    const pool = getPool();
    const projRes = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    if (projRes.rowCount === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Verify account belongs to project
    const accountRes = await pool.query(
      'SELECT id FROM cloud_accounts WHERE id = $1 AND project_id = $2',
      [cloudAccountId, projectId]
    );
    if (accountRes.rowCount === 0) {
      res.status(404).json({ error: 'Cloud account not found in project' });
      return;
    }

    // Verify analysis run belongs to account
    const runRes = await pool.query<{ id: number, status: string }>(
      'SELECT id, status FROM analysis_runs WHERE id = $1 AND account_id = $2',
      [analysisRunId, cloudAccountId]
    );
    if (runRes.rowCount === 0) {
      res.status(404).json({ error: 'Analysis run not found for cloud account' });
      return;
    }

    const runData = runRes.rows[0];
    if (runData.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Cannot evaluate an analysis run that is not COMPLETED' });
      return;
    }

    // Run security evaluation
    const result = await runSecurityEvaluation(
      Number(projectId),
      cloudAccountId,
      analysisRunId
    );

    res.status(200).json({
      message: 'Security evaluation completed',
      evaluatedRules: result.evaluatedRules.length,
      findingsCreated: result.findingsCreated,
      findingsUpdated: result.findingsUpdated,
      findingsResolved: result.findingsResolved
    });

  } catch (err: unknown) {
    logger.error(`Error in evaluateAnalysisRunController: ${err instanceof Error ? err.message : String(err)}`);
    // Attempt to log failure
    try {
      await getPool().query(
        `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, $2, 'SECURITY_EVALUATION_FAILED', 'ANALYSIS_RUN', $3, $4, CURRENT_TIMESTAMP)`,
        [
          projectId,
          userId,
          analysisRunId,
          JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
        ]
      );
    } catch (_auditErr: unknown) {
      logger.error('Failed to write SECURITY_EVALUATION_FAILED audit log');
    }

    res.status(500).json({ error: 'Internal server error during evaluation' });
  }
}
