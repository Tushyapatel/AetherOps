/**
 * AtherOps Backend – Project Controller
 *
 * Handles request parsing, Zod validation, and JSON responses.
 * Never trusts request bodies for user_id. Always uses req.user.id.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../../errors';
import { createProjectSchema, updateProjectSchema } from './project.validation';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from './project.service';

// Basic validation for project ID parameter (preventing SQL injection or malformed input)
const projectIdSchema = z.string().regex(/^\d+$/, 'Project ID must be numeric');

export async function listProjectsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const projects = await getProjects(req.user.id);
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

export async function getProjectController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdSchema.parse(req.params.projectId);

    const project = await getProject(projectId, req.user.id);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function createProjectController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const input = createProjectSchema.parse(req.body);

    const project = await createProject(req.user.id, input);
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function updateProjectController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdSchema.parse(req.params.projectId);
    const input = updateProjectSchema.parse(req.body);

    const project = await updateProject(projectId, req.user.id, input);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProjectController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();
    const projectId = projectIdSchema.parse(req.params.projectId);

    await deleteProject(projectId, req.user.id);
    res.status(200).json({ success: true, data: { message: 'Project deleted successfully' } });
  } catch (err) {
    next(err);
  }
}
