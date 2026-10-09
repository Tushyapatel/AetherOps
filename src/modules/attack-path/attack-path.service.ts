import * as crypto from 'crypto';
import { logger } from '../../logger';
import {
  getResourcesForAccount,
  getRelationshipsForAccount,
  getFindingsForAccount,
  saveAttackPaths,
  checkAnalysisRunOwnership
} from './attack-path.repository';
import { buildGraph, traverseAttackPaths } from './graph';
import { AttackPath } from './attack-path.types';

export async function analyzeAttackPaths(
  userId: number,
  projectId: number,
  cloudAccountId: number,
  analysisRunId: number
) {
  // 1. Verify ownership
  const isOwner = await checkAnalysisRunOwnership(userId, projectId, cloudAccountId, analysisRunId);
  if (!isOwner) {
    throw new Error('Analysis run not found or does not belong to this project/account');
  }

  logger.info('ATTACK_PATH_ANALYSIS_STARTED', {
    projectId,
    cloudAccountId,
    analysisRunId,
  });

  const startTime = Date.now();

  try {
    // 2. Load data
    const resources = await getResourcesForAccount(cloudAccountId);
    const relationships = await getRelationshipsForAccount(cloudAccountId);
    const findings = await getFindingsForAccount(cloudAccountId, analysisRunId);

    // 3. Build graph
    const graph = buildGraph(resources, relationships, findings);

    // 4. Traverse bounded graph to find valid paths
    const rawPaths = traverseAttackPaths(graph);

    // 5. Transform raw paths to AttackPath DB shape
    const attackPathsToSave: AttackPath[] = rawPaths.map(path => {
      // Determine overall severity (max of all findings in path)
      let hasHigh = false;
      let hasMedium = false;

      const pathDbIds = path.map(n => n.dbId).join('->');
      const pathHash = crypto.createHash('sha256').update(pathDbIds).digest('hex');

      const findingChain = path.map(node => {
        const findingIds = node.findings.map(f => f.ruleId);
        
        for (const f of node.findings) {
          if (f.severity === 'HIGH') hasHigh = true;
          if (f.severity === 'MEDIUM') hasMedium = true;
        }

        return {
          resourceId: node.resourceId,
          resourceType: node.resourceType,
          findingIds
        };
      });

      const overallSeverity = hasHigh ? 'HIGH' : (hasMedium ? 'MEDIUM' : 'LOW');
      const description = `Discovered attack path involving ${path.length} connected resources.`;

      return {
        accountId: cloudAccountId,
        analysisRunId: analysisRunId,
        pathHash,
        severity: overallSeverity,
        findingChain,
        description
      };
    });

    // 6. Deduplicate and persist paths
    const pathsSaved = await saveAttackPaths(cloudAccountId, analysisRunId, attackPathsToSave);

    const durationMs = Date.now() - startTime;
    logger.info('ATTACK_PATH_ANALYSIS_COMPLETED', {
      projectId,
      cloudAccountId,
      analysisRunId,
      pathsDiscovered: pathsSaved,
      durationMs,
    });

    return {
      success: true,
      pathsDiscovered: pathsSaved,
      durationMs
    };
  } catch (error) {
    logger.error('ATTACK_PATH_ANALYSIS_FAILED', {
      projectId,
      cloudAccountId,
      analysisRunId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
