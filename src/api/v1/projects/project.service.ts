/**
 * AtherOps Backend – Project Service
 *
 * Business logic for project management.
 * Enforces ownership and handles duplicate name conflicts cleanly.
 */

import { ConflictError, NotFoundError } from '../../../errors';
import {
  findProjectsByUserId,
  findProjectByIdAndUserId,
  createProject as createProjectRepo,
  updateProject as updateProjectRepo,
  deleteProject as deleteProjectRepo,
  checkProjectNameExists,
} from './project.repository';
import { Project, ProjectRow } from './project.types';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPublicProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function getProjects(userId: number): Promise<Project[]> {
  const rows = await findProjectsByUserId(userId);
  return rows.map(toPublicProject);
}

export async function getProject(id: string, userId: number): Promise<Project> {
  const row = await findProjectByIdAndUserId(id, userId);
  if (!row) {
    throw new NotFoundError('Project');
  }
  return toPublicProject(row);
}

export async function createProject(
  userId: number,
  input: CreateProjectInput
): Promise<Project> {
  // Check unique constraint manually for a cleaner error (prevent Postgres error 23505)
  const exists = await checkProjectNameExists(userId, input.name);
  if (exists) {
    throw new ConflictError('A project with this name already exists.');
  }

  const row = await createProjectRepo(userId, input.name, input.description ?? null);
  return toPublicProject(row);
}

export async function updateProject(
  id: string,
  userId: number,
  input: UpdateProjectInput
): Promise<Project> {
  // Ensure the project exists and belongs to the user
  const existing = await findProjectByIdAndUserId(id, userId);
  if (!existing) {
    throw new NotFoundError('Project');
  }

  // Check unique constraint if name is changing
  if (input.name !== undefined && input.name !== existing.name) {
    const exists = await checkProjectNameExists(userId, input.name);
    if (exists) {
      throw new ConflictError('A project with this name already exists.');
    }
  }

  const descriptionToUpdate = input.description !== undefined ? input.description : existing.description;

  const updatedRow = await updateProjectRepo(id, userId, input.name, descriptionToUpdate);
  
  if (!updatedRow) {
     // Defensive fallback in case it was deleted concurrently
     throw new NotFoundError('Project');
  }

  return toPublicProject(updatedRow);
}

export async function deleteProject(id: string, userId: number): Promise<void> {
  // deleteProjectRepo handles existence and ownership check
  const deleted = await deleteProjectRepo(id, userId);
  if (!deleted) {
    throw new NotFoundError('Project');
  }
}
