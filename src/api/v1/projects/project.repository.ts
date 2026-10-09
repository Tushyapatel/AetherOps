/**
 * AtherOps Backend – Project Repository
 *
 * Handles database operations for projects.
 * Enforces ownership strictly at the database layer (user_id is always required).
 * Handles audit logging.
 */

import { getPool, withClient } from '../../../database';
import { ProjectRow } from './project.types';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function findProjectsByUserId(userId: number): Promise<ProjectRow[]> {
  const result = await getPool().query(
    `SELECT id, user_id, name, description, created_at, updated_at
     FROM projects
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  return result.rows as ProjectRow[];
}

export async function findProjectByIdAndUserId(
  id: string,
  userId: number
): Promise<ProjectRow | null> {
  const result = await getPool().query(
    `SELECT id, user_id, name, description, created_at, updated_at
     FROM projects
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, userId]
  );
  return (result.rows[0] as ProjectRow | undefined) ?? null;
}

export async function checkProjectNameExists(
  userId: number,
  name: string
): Promise<boolean> {
  const result = await getPool().query(
    `SELECT EXISTS(
       SELECT 1 FROM projects WHERE user_id = $1 AND name = $2
     ) AS exists`,
    [userId, name]
  );
  return (result.rows[0] as { exists: boolean })?.exists === true;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createProject(
  userId: number,
  name: string,
  description: string | null
): Promise<ProjectRow> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO projects (user_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, name, description, created_at, updated_at`,
        [userId, name, description]
      );
      const project = result.rows[0] as ProjectRow;

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, project.id, 'PROJECT_CREATED', 'project', project.id, JSON.stringify({ name, description })]
      );

      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function updateProject(
  id: string,
  userId: number,
  name: string | undefined,
  description: string | null | undefined
): Promise<ProjectRow | null> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return await findProjectByIdAndUserId(id, userId);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, userId); // Add where parameters at the end

      const queryStr = `
        UPDATE projects
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING id, user_id, name, description, created_at, updated_at
      `;

      const result = await client.query(queryStr, values);
      const updatedProject = result.rows[0] as ProjectRow | undefined;

      if (updatedProject) {
         // Audit Log
         await client.query(
          `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, updatedProject.id, 'PROJECT_UPDATED', 'project', updatedProject.id, JSON.stringify({ name, description })]
        );
      }

      await client.query('COMMIT');
      return updatedProject ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function deleteProject(id: string, userId: number): Promise<boolean> {
  return await withClient(async (client) => {
    try {
      await client.query('BEGIN');

      // We need to fetch the project first to ensure it existed before deletion to accurately log.
      const fetchResult = await client.query(
        'SELECT name FROM projects WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (fetchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      const projectName = (fetchResult.rows[0] as { name: string }).name;

      const result = await client.query(
        `DELETE FROM projects
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, userId]
      );

      const deleted = (result.rowCount ?? 0) > 0;

      if (deleted) {
         // Audit Log
         // Note: project_id might be set to NULL if ON DELETE SET NULL is enforced before the log is inserted, 
         // but since we are inserting the log, the foreign key might be violated if we try to link to a deleted project.
         // Actually, if we delete the project, the audit log's project_id FK will be SET NULL.
         // Let's omit project_id or let it be set to null by the DB, but store the ID in details or entity_id.
         // The DB constraint is: "audit_logs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
         // So if we insert it and the project is gone, it fails unless we insert AFTER delete with project_id = null.
         // But we can just use entity_id which has no FK.
         await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'PROJECT_DELETED', 'project', id, JSON.stringify({ name: projectName })]
        );
      }

      await client.query('COMMIT');
      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
