/**
 * AtherOps Backend – Cloud Account Validation
 */

import { z } from 'zod';

export const cloudAccountIdParamSchema = z
  .string()
  .regex(/^\d+$/, 'Cloud Account ID must be numeric');

export const projectIdParamSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be numeric');

// Shared metadata rules
const accountNameSchema = z.string().min(1).max(255).trim();
const environmentSchema = z.enum(['development', 'staging', 'production', 'sandbox']).nullable().optional();
const regionSchema = z.string().regex(/^[a-z]{2}-[a-z]+-\d+$/, 'Must be a valid AWS region (e.g., us-east-1)');
const descriptionSchema = z.string().max(1000).trim().nullable().optional();
// Role ARN loosely validated for standard AWS IAM roles: arn:aws:iam::ACCOUNT-ID:role/ROLE-NAME
const roleArnSchema = z.string().regex(/^arn:aws(-us-gov|-cn)?:iam::\d{12}:role\/.+$/, 'Must be a valid AWS IAM role ARN').nullable().optional();

export const createCloudAccountSchema = z.object({
  provider: z.literal('AWS'),
  account_id: z.string().regex(/^\d{12}$/, 'AWS Account ID must be exactly 12 digits'),
  account_name: accountNameSchema,
  environment: environmentSchema,
  region: regionSchema,
  mode: z.enum(['LIVE', 'DEMO']).default('LIVE'),
  description: descriptionSchema,
  role_arn: roleArnSchema,
});

export type CreateCloudAccountInput = z.infer<typeof createCloudAccountSchema>;

export const updateCloudAccountSchema = z.object({
  account_name: accountNameSchema.optional(),
  environment: environmentSchema,
  region: regionSchema.optional(),
  description: descriptionSchema,
  role_arn: roleArnSchema,
});

export type UpdateCloudAccountInput = z.infer<typeof updateCloudAccountSchema>;
