/**
 * AtherOps Backend – Project Validation Schemas
 *
 * Zod schemas for parsing and validating project requests.
 */

import { z } from 'zod';

// ── Shared fields ─────────────────────────────────────────────────────────────

const nameSchema = z
  .string()
  .min(1, 'Project name is required')
  .max(150, 'Project name must be at most 150 characters')
  .trim();

const descriptionSchema = z
  .string()
  .max(1000, 'Description must be at most 1000 characters')
  .trim()
  .optional()
  .nullable();

// ── Create Project ────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ── Update Project ────────────────────────────────────────────────────────────

export const updateProjectSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
