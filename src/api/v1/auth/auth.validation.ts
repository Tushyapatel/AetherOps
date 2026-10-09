/**
 * AtherOps Backend – Auth Validation Schemas
 *
 * Zod schemas for parsing and validating authentication request bodies.
 * Using Zod keeps validation consistent with the rest of the application.
 *
 * Note: Using Zod v4 API — required_error was removed; use .min(1) instead.
 */

import { z } from 'zod';

// ── Register ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address')
    .max(255, 'Email must be at most 255 characters')
    .transform((e) => e.toLowerCase().trim()),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address')
    .max(255)
    .transform((e) => e.toLowerCase().trim()),

  password: z
    .string()
    .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
