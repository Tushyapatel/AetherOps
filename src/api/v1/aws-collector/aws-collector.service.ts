import { getTemporaryCredentials } from '../../../infrastructure/aws/aws.sts';
import { findCloudAccountById } from '../cloud-accounts/cloudAccount.repository';
import { runAwsDiscovery } from './aws-discovery';
import { 
  createAnalysisRun, 
  updateAnalysisRun, 
  upsertResource, 
  upsertRelationship 
} from './aws-collector.repository';
import { getPool } from '../../../database';
import { NotFoundError, ValidationError } from '../../../errors';

export async function runAwsCollection(projectId: string, cloudAccountId: number, userId: number) {
  // 1. Fetch Cloud Account and verify ownership safely
  const cloudAccount = await findCloudAccountById(cloudAccountId, projectId, userId);
  if (!cloudAccount) {
    throw new NotFoundError('Cloud Account');
  }

  // Log Discovery Started
  await getPool().query(
    `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, projectId, 'AWS_DISCOVERY_STARTED', 'cloud_account', cloudAccountId, JSON.stringify({ account_id: cloudAccount.account_id })]
  );

  // Demo Protection
  if (cloudAccount.mode === 'DEMO') {
    return {
      status: 'CANCELLED',
      message: 'Discovery skipped for DEMO cloud account. Live AWS APIs cannot be called.',
    };
  }

  if (!cloudAccount.role_arn) {
    throw new ValidationError('Role ARN is missing. Configure AWS connection first.');
  }

  // 2. Create Analysis Run
  const runId = await createAnalysisRun(projectId, cloudAccountId);

  let tempCreds;
  try {
    tempCreds = await getTemporaryCredentials(cloudAccount.role_arn, cloudAccount.external_id);
  } catch (error: any) {
    await updateAnalysisRun(runId, 'FAILED', 0, error.message || 'AssumeRole failed');
    await logAudit(userId, projectId, 'AWS_DISCOVERY_FAILED', cloudAccountId, { error: error.message });
    throw error;
  }

  // 3. Run Discovery
  let discoveryResult;
  try {
    discoveryResult = await runAwsDiscovery(tempCreds, cloudAccount.region, cloudAccount.account_id);
  } catch (error: any) {
    await updateAnalysisRun(runId, 'FAILED', 0, error.message || 'Discovery orchestration failed');
    await logAudit(userId, projectId, 'AWS_DISCOVERY_FAILED', cloudAccountId, { error: error.message });
    throw error;
  }

  // 4. Persistence (Idempotent Upsert)
  const client = await getPool().connect();
  let resourcesCreated = 0;
  let resourcesUpdated = 0;
  let relationshipsCreated = 0;

  // We map arbitrary string identifiers to integer internal resource IDs to create relationships
  const internalIdMap = new Map<string, number>(); // format: `resourceType:resourceId` => internal DB ID

  try {
    await client.query('BEGIN');

    // Persist Resources
    for (const res of discoveryResult.resources) {
      const { id, created } = await upsertResource(client, {
        accountId: cloudAccountId,
        resourceType: res.resourceType,
        resourceId: res.resourceId,
        arn: res.arn,
        name: res.name,
        region: res.region,
        status: res.status,
        attributes: res.attributes
      });

      if (created) resourcesCreated++;
      else resourcesUpdated++;

      internalIdMap.set(`${res.resourceType}:${res.resourceId}`, id);

      // Handle cases where ARN is the identifier (e.g. IAM Role for Lambda links)
      if (res.arn) {
        internalIdMap.set(`ARN:${res.arn}`, id);
      }
    }

    // Persist Relationships
    for (const rel of discoveryResult.relationships) {
      // Resolve IDs
      const aId = internalIdMap.get(`${rel.resourceAType}:${rel.resourceAId}`) || internalIdMap.get(`ARN:${rel.resourceAId}`);
      const bId = internalIdMap.get(`${rel.resourceBType}:${rel.resourceBId}`) || internalIdMap.get(`ARN:${rel.resourceBId}`);
      
      if (aId && bId) {
        const { created } = await upsertRelationship(client, {
          accountId: cloudAccountId,
          resourceAId: aId,
          resourceBId: bId,
          relationType: rel.relationType
        });
        if (created) relationshipsCreated++;
      }
    }

    await client.query('COMMIT');
  } catch (dbError: any) {
    await client.query('ROLLBACK');
    await updateAnalysisRun(runId, 'FAILED', 0, `Database transaction failed: ${dbError.message}`);
    await logAudit(userId, projectId, 'AWS_DISCOVERY_FAILED', cloudAccountId, { error: dbError.message });
    throw dbError;
  } finally {
    client.release();
  }

  // 5. Update Run Success
  const totalScanned = discoveryResult.resources.length;
  await updateAnalysisRun(runId, 'COMPLETED', totalScanned, discoveryResult.errors.join('; '));

  await logAudit(userId, projectId, 'AWS_DISCOVERY_COMPLETED', cloudAccountId, {
    resourcesScanned: totalScanned,
    resourcesCreated,
    resourcesUpdated,
    relationshipsCreated,
    warnings: discoveryResult.errors
  });

  return {
    analysisRunId: runId,
    status: 'COMPLETED',
    resourcesScanned: totalScanned,
    resourcesCreated,
    resourcesUpdated,
    relationshipsCreated,
    warnings: discoveryResult.errors,
    completedAt: new Date().toISOString()
  };
}

async function logAudit(userId: number, projectId: string, action: string, cloudAccountId: number, details: any) {
  await getPool().query(
    `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, projectId, action, 'cloud_account', cloudAccountId, JSON.stringify(details)]
  );
}
