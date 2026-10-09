/**
 * AtherOps – AI Service
 *
 * Orchestrates AI analysis operations.
 * Assembles context → calls provider → validates output → emits audit events.
 * Never exposes API keys, raw prompts, or credentials.
 */

import { config } from '../../config';
import { logger } from '../../logger';
import { getPool } from '../../database';
import { GeminiProvider } from './providers/gemini/gemini.provider';
import {
  buildProjectSecurityContext,
  buildProjectOverviewContext,
  buildProjectCostContext,
  buildAttackPathContext,
  serializeContext,
  validateSourceRefs,
} from './ai.context';
import {
  buildSecurityAnalysisPrompt,
  buildProjectOverviewPrompt,
  buildCostAnalysisPrompt,
  buildAttackPathAnalysisPrompt,
  SYSTEM_INSTRUCTION,
} from './ai.prompts';
import {
  AIProvider,
  AIContext,
  AIOperation,
  AIAnalysisResponse,
  AIError,
} from './ai.types';

// ── Provider factory ───────────────────────────────────────────────────────

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (_provider) return _provider;

  const keys = [
    config.ai.geminiApiKey1,
    config.ai.geminiApiKey2,
    config.ai.geminiApiKey3,
    config.ai.geminiApiKey4,
    config.ai.geminiApiKey,
  ].filter((k): k is string => !!k);

  if (keys.length === 0) {
    throw new AIError('API_KEY_MISSING', 'GEMINI_API_KEY is not configured', false);
  }

  // Filter out duplicates (if GEMINI_API_KEY is same as 1)
  const uniqueKeys = Array.from(new Set(keys));

  _provider = new GeminiProvider(
    uniqueKeys,
    config.ai.model,
    config.ai.timeoutMs,
    config.ai.maxRetries,
    config.ai.geminiKeyCooldownSeconds
  );
  return _provider;
}

/** For testing: inject a mock provider */
export function _setProviderForTest(p: AIProvider | null): void {
  _provider = p;
}

// ── Audit helpers ──────────────────────────────────────────────────────────

export async function emitAudit(
  projectId: string,
  userId: number,
  action: 'AI_ANALYSIS_STARTED' | 'AI_ANALYSIS_COMPLETED' | 'AI_ANALYSIS_FAILED' | 'AI_CHAT_STARTED' | 'AI_CHAT_COMPLETED' | 'AI_CHAT_FAILED',
  details: Record<string, unknown>
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, 'AI_ANALYSIS', NULL, $4, CURRENT_TIMESTAMP)`,
      [projectId, userId, action, JSON.stringify(details)]
    );
  } catch (err) {
    logger.warn('Failed to write AI audit log', { error: err });
  }
}

// ── Core analysis runner ───────────────────────────────────────────────────

async function runAnalysis(
  operation: AIOperation,
  projectId: string,
  userId: number,
  contextBuilder: () => Promise<AIContext>,
  promptBuilder: (contextText: string) => string
): Promise<AIAnalysisResponse> {
  if (!config.ai.enabled) {
    throw new AIError('AI_DISABLED', 'AI analysis is disabled (AI_ENABLED=false)', false);
  }

  const provider = getProvider();
  const startedAt = new Date().toISOString();

  await emitAudit(projectId, userId, 'AI_ANALYSIS_STARTED', {
    operation,
    provider: provider.providerName,
    model: provider.modelName,
  });

  try {
    // 1. Build verified context
    const ctx = await contextBuilder();

    // 2. Serialize context as structured text
    const contextText = serializeContext(ctx);

    // 3. Build prompt
    const userPrompt = promptBuilder(contextText);

    // 4. Call AI provider
    const rawResult = await provider.generateAnalysis({
      operation,
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt,
    });

    // 5. Validate source references (prevent model from inventing IDs)
    const refErrors = validateSourceRefs(rawResult, ctx);
    if (refErrors.length > 0) {
      logger.warn('AI response contained invalid source references — stripping them', { refErrors });
      // Strip invalid refs rather than rejecting entirely
      for (const insight of rawResult.keyInsights) {
        insight.sourceRefs = insight.sourceRefs.filter((ref) => {
          const typeOk = ['PROJECT', 'ACCOUNT', 'RESOURCE', 'FINDING', 'ATTACK_PATH', 'RISK_SCORE', 'COST', 'PRICING'].includes(ref.type);
          return typeOk;
        });
      }
      for (const action of rawResult.recommendedActions) {
        action.sourceRefs = action.sourceRefs.filter((ref) => {
          return ['PROJECT', 'ACCOUNT', 'RESOURCE', 'FINDING', 'ATTACK_PATH', 'RISK_SCORE', 'COST', 'PRICING'].includes(ref.type);
        });
      }
      rawResult.limitations.push('Some source references were removed due to validation failures.');
    }

    const response: AIAnalysisResponse = {
      operation,
      model: provider.modelName,
      provider: provider.providerName,
      generatedAt: startedAt,
      summary: rawResult.summary,
      keyInsights: rawResult.keyInsights,
      recommendedActions: rawResult.recommendedActions,
      limitations: rawResult.limitations,
    };

    await emitAudit(projectId, userId, 'AI_ANALYSIS_COMPLETED', {
      operation,
      provider: provider.providerName,
      model: provider.modelName,
      insightCount: rawResult.keyInsights.length,
      actionCount: rawResult.recommendedActions.length,
    });

    logger.info('AI analysis completed', {
      operation,
      projectId,
      model: provider.modelName,
      insightCount: rawResult.keyInsights.length,
    });

    return response;
  } catch (err) {
    const code = err instanceof AIError ? err.code : 'PROVIDER_ERROR';
    const _message = err instanceof Error ? err.message : String(err);

    await emitAudit(projectId, userId, 'AI_ANALYSIS_FAILED', {
      operation,
      provider: provider.providerName,
      model: provider.modelName,
      errorCode: code,
    });

    logger.error('AI analysis failed', { operation, projectId, code });
    throw err;
  }
}

// ── Public operations ──────────────────────────────────────────────────────

export async function runSecurityAnalysis(
  projectId: string,
  userId: number
): Promise<AIAnalysisResponse> {
  return runAnalysis(
    'SECURITY_ANALYSIS',
    projectId,
    userId,
    () => buildProjectSecurityContext(projectId, userId),
    buildSecurityAnalysisPrompt
  );
}

export async function runProjectOverview(
  projectId: string,
  userId: number
): Promise<AIAnalysisResponse> {
  return runAnalysis(
    'PROJECT_OVERVIEW',
    projectId,
    userId,
    () => buildProjectOverviewContext(projectId, userId),
    buildProjectOverviewPrompt
  );
}

export async function runCostAnalysis(
  projectId: string,
  userId: number
): Promise<AIAnalysisResponse> {
  return runAnalysis(
    'COST_ANALYSIS',
    projectId,
    userId,
    () => buildProjectCostContext(projectId, userId),
    buildCostAnalysisPrompt
  );
}

export async function runAttackPathAnalysis(
  projectId: string,
  userId: number
): Promise<AIAnalysisResponse> {
  return runAnalysis(
    'ATTACK_PATH_ANALYSIS',
    projectId,
    userId,
    () => buildAttackPathContext(projectId, userId),
    buildAttackPathAnalysisPrompt
  );
}
