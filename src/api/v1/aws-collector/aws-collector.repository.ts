import { getPool } from '../../../database';

export interface UpsertResourceInput {
  accountId: number;
  resourceType: string;
  resourceId: string;
  arn: string | null;
  name: string | null;
  region: string | null;
  status: string | null;
  attributes: any;
}

export interface UpsertRelationshipInput {
  accountId: number;
  resourceAId: number;
  resourceBId: number;
  relationType: string;
}

export async function createAnalysisRun(projectId: string, accountId: number): Promise<number> {
  const result = await getPool().query(
    `INSERT INTO analysis_runs (project_id, account_id, status)
     VALUES ($1, $2, 'RUNNING')
     RETURNING id`,
    [projectId, accountId]
  );
  return parseInt(result.rows[0].id, 10);
}

export async function updateAnalysisRun(
  runId: number, 
  status: 'COMPLETED' | 'FAILED', 
  resourcesScanned: number, 
  errorMessage?: string
): Promise<void> {
  await getPool().query(
    `UPDATE analysis_runs 
     SET status = $1, resources_scanned = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [status, resourcesScanned, errorMessage || null, runId]
  );
}

export async function upsertResource(client: any, input: UpsertResourceInput): Promise<{ id: number, created: boolean }> {
  // Use atomic UPSERT (ON CONFLICT DO UPDATE)
  const result = await client.query(
    `INSERT INTO resources (account_id, resource_type, resource_id, arn, name, region, status, attributes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (account_id, resource_type, resource_id) DO UPDATE
     SET arn = EXCLUDED.arn,
         name = EXCLUDED.name,
         region = EXCLUDED.region,
         status = EXCLUDED.status,
         attributes = EXCLUDED.attributes
     RETURNING id, (xmax = 0) AS is_inserted`,
    [
      input.accountId,
      input.resourceType,
      input.resourceId,
      input.arn,
      input.name,
      input.region,
      input.status,
      JSON.stringify(input.attributes)
    ]
  );

  return { 
    id: result.rows[0].id, 
    created: result.rows[0].is_inserted 
  };
}

export async function upsertRelationship(client: any, input: UpsertRelationshipInput): Promise<{ id: number, created: boolean }> {
  // Use atomic UPSERT (ON CONFLICT DO UPDATE)
  const result = await client.query(
    `INSERT INTO relationships (account_id, resource_a_id, resource_b_id, relation_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, resource_a_id, resource_b_id, relation_type) DO UPDATE
     SET created_at = CURRENT_TIMESTAMP
     RETURNING id, (xmax = 0) AS is_inserted`,
    [
      input.accountId,
      input.resourceAId,
      input.resourceBId,
      input.relationType
    ]
  );

  return { 
    id: result.rows[0].id, 
    created: result.rows[0].is_inserted 
  };
}
