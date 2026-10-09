/**
 * AtherOps – AI Schemas
 *
 * Zod schemas for validating structured AI output.
 * Never blindly trust model output — all responses are validated.
 */

import { z } from 'zod';

// ── Severity enum ─────────────────────────────────────────────────────────

export const AISeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

// ── Source reference ───────────────────────────────────────────────────────

export const SourceRefTypeSchema = z.enum([
  'PROJECT',
  'ACCOUNT',
  'RESOURCE',
  'FINDING',
  'ATTACK_PATH',
  'RISK_SCORE',
  'COST',
  'PRICING',
]);

export const SourceRefSchema = z.object({
  type: SourceRefTypeSchema,
  id: z.string().min(1).max(255),
});

// ── Key insight ────────────────────────────────────────────────────────────

export const AIKeyInsightSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(2000),
  severity: AISeveritySchema,
  sourceRefs: z.array(SourceRefSchema).max(20),
});

// ── Recommended action ─────────────────────────────────────────────────────

export const AIRecommendedActionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(2000),
  sourceRefs: z.array(SourceRefSchema).max(20),
});

// ── Full AI analysis output ────────────────────────────────────────────────

export const AIAnalysisResultSchema = z.object({
  summary: z.string().min(1).max(3000),
  keyInsights: z.array(AIKeyInsightSchema).max(20),
  recommendedActions: z.array(AIRecommendedActionSchema).max(10),
  limitations: z.array(z.string().max(500)).max(10),
});

/**
 * JSON Schema for Gemini structured output (responseMimeType: application/json).
 * Must be a plain object compatible with Gemini's SchemaUnion format.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    keyInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: {
            type: 'string',
            enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
          },
          sourceRefs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['PROJECT', 'ACCOUNT', 'RESOURCE', 'FINDING', 'ATTACK_PATH', 'RISK_SCORE', 'COST', 'PRICING'],
                },
                id: { type: 'string' },
              },
              required: ['type', 'id'],
            },
          },
        },
        required: ['title', 'description', 'severity', 'sourceRefs'],
      },
    },
    recommendedActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          sourceRefs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['PROJECT', 'ACCOUNT', 'RESOURCE', 'FINDING', 'ATTACK_PATH', 'RISK_SCORE', 'COST', 'PRICING'],
                },
                id: { type: 'string' },
              },
              required: ['type', 'id'],
            },
          },
        },
        required: ['title', 'description', 'sourceRefs'],
      },
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'keyInsights', 'recommendedActions', 'limitations'],
};

export const AIChatResultSchema = z.object({
  answer: z.string().min(1).max(10000),
  intent: z.enum(['OVERVIEW', 'SECURITY', 'COST', 'RESOURCES', 'ATTACK_PATH', 'RISK', 'GENERAL', 'UNSUPPORTED']),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'NONE']),
  sourceRefs: z.array(z.string().max(255)).max(50),
  limitations: z.array(z.string().max(500)).max(10),
});

export const GEMINI_CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    intent: {
      type: 'string',
      enum: ['OVERVIEW', 'SECURITY', 'COST', 'RESOURCES', 'ATTACK_PATH', 'RISK', 'GENERAL', 'UNSUPPORTED'],
    },
    severity: {
      type: 'string',
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'NONE'],
    },
    sourceRefs: {
      type: 'array',
      items: { type: 'string' },
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['answer', 'intent', 'severity', 'sourceRefs', 'limitations'],
};

export { z };
