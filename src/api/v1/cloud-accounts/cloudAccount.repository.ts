/**
 * AtherOps Backend – Cloud Account Repository
 *
 * Implements strict ownership hierarchy:
 * user_id -> project_id -> cloud_account_id
 */

import { getPool, withClient } from '../../../database';
import { CloudAccountRow } from './cloudAccount.types';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function findCloudAccountsByProject(
  projectId: string,
  userId: number
): Promise<CloudAccountRow[]> {
  const result = await getPool().query(
    `SELECT ca.id, ca.user_id, ca.project_id, ca.provider, ca.account_id, 
            ca.account_name, ca.environment, ca.region, ca.mode, ca.description, 
            ca.role_arn, ca.external_id, ca.created_at, ca.last_scanned_at
     FROM cloud_accounts ca
     JOIN projects p ON ca.project_id = p.id
     WHERE ca.project_id = $1 AND p.user_id = $2
     ORDER BY ca.created_at DESC`,
    [projectId, userId]
  );
  return result.rows as CloudAccountRow[];
}

export async function findCloudAccountById(
  accountId: number,
  projectId: string,
  userId: number
): Promise<CloudAccountRow | null> {
  const result = await getPool().query(
    `SELECT ca.id, ca.user_id, ca.project_id, ca.provider, ca.account_id, 
            ca.account_name, ca.environment, ca.region, ca.mode, ca.description, 
            ca.role_arn, ca.external_id, ca.created_at, ca.last_scanned_at
     FROM cloud_accounts ca
     JOIN projects p ON ca.project_id = p.id
     WHERE ca.id = $1 AND ca.project_id = $2 AND p.user_id = $3
     LIMIT 1`,
    [accountId, projectId, userId]
  );
  return (result.rows[0] as CloudAccountRow | undefined) ?? null;
}

export async function checkProjectOwnership(
  projectId: string,
  userId: number
): Promise<boolean> {
  const result = await getPool().query(
    `SELECT EXISTS(
       SELECT 1 FROM projects WHERE id = $1 AND user_id = $2
     ) AS exists`,
    [projectId, userId]
  );
  return (result.rows[0] as { exists: boolean })?.exists === true;
}

export async function checkAccountInProject(
  projectId: string,
  awsAccountId: string
): Promise<boolean> {
  // Prevent duplicate AWS accounts in the same project to avoid confusion
  const result = await getPool().query(
    `SELECT EXISTS(
       SELECT 1 FROM cloud_accounts WHERE project_id = $1 AND account_id = $2
     ) AS exists`,
    [projectId, awsAccountId]
  );
  return (result.rows[0] as { exists: boolean })?.exists === true;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createCloudAccount(
  userId: number,
  projectId: string,
  data: {
    provider: string;
    account_id: string;
    account_name: string;
    environment: string | null;
    region: string;
    mode: string;
    description: string | null;
    role_arn: string | null;
  }
): Promise<CloudAccountRow> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO cloud_accounts (
           user_id, project_id, provider, account_id, account_name, 
           environment, region, mode, description, role_arn, external_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, gen_random_uuid())
         RETURNING *`,
        [
          userId,
          projectId,
          data.provider,
          data.account_id,
          data.account_name,
          data.environment,
          data.region,
          data.mode,
          data.description,
          data.role_arn,
        ]
      );
      const row = result.rows[0] as CloudAccountRow;

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          projectId,
          'CLOUD_ACCOUNT_CREATED',
          'cloud_account',
          row.id,
          JSON.stringify({ account_id: row.account_id, account_name: row.account_name, mode: row.mode })
        ]
      );

      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function updateCloudAccount(
  accountId: number,
  projectId: string,
  userId: number,
  data: {
    account_name?: string;
    environment?: string | null;
    region?: string;
    description?: string | null;
    role_arn?: string | null;
  }
): Promise<CloudAccountRow | null> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      // First verify ownership chain explicitly before updating
      const checkResult = await client.query(
        `SELECT ca.id 
         FROM cloud_accounts ca
         JOIN projects p ON ca.project_id = p.id
         WHERE ca.id = $1 AND ca.project_id = $2 AND p.user_id = $3`,
        [accountId, projectId, userId]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null; // Does not exist or unauthorized
      }

      // Build dynamic update
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.account_name !== undefined) {
        updates.push(`account_name = $${paramIndex++}`);
        values.push(data.account_name);
      }
      if (data.environment !== undefined) {
        updates.push(`environment = $${paramIndex++}`);
        values.push(data.environment);
      }
      if (data.region !== undefined) {
        updates.push(`region = $${paramIndex++}`);
        values.push(data.region);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.role_arn !== undefined) {
        updates.push(`role_arn = $${paramIndex++}`);
        values.push(data.role_arn);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return await findCloudAccountById(accountId, projectId, userId);
      }

      values.push(accountId);
      const queryStr = `
        UPDATE cloud_accounts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(queryStr, values);
      const updatedRow = result.rows[0] as CloudAccountRow;

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          projectId,
          'CLOUD_ACCOUNT_UPDATED',
          'cloud_account',
          updatedRow.id,
          JSON.stringify(data)
        ]
      );

      await client.query('COMMIT');
      return updatedRow;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function disconnectCloudAccount(
  accountId: number,
  projectId: string,
  userId: number
): Promise<boolean> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      // Verify ownership chain
      const fetchResult = await client.query(
        `SELECT ca.account_id, ca.account_name 
         FROM cloud_accounts ca
         JOIN projects p ON ca.project_id = p.id
         WHERE ca.id = $1 AND ca.project_id = $2 AND p.user_id = $3`,
        [accountId, projectId, userId]
      );

      if (fetchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      const { account_id, account_name } = fetchResult.rows[0] as { account_id: string, account_name: string };

      // Execute disconnect instead of DELETE
      const result = await client.query(
        `UPDATE cloud_accounts
         SET project_id = NULL
         WHERE id = $1`,
        [accountId]
      );

      const disconnected = (result.rowCount ?? 0) > 0;

      if (disconnected) {
        // Audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            projectId,
            'CLOUD_ACCOUNT_DISCONNECTED',
            'cloud_account',
            accountId,
            JSON.stringify({ account_id, account_name })
          ]
        );
      }

      await client.query('COMMIT');
      return disconnected;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
