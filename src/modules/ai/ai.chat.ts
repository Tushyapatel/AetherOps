import { logger } from '../../logger';
import {
  buildProjectSecurityContext,
  buildProjectOverviewContext,
  buildProjectCostContext,
  buildAttackPathContext,
  serializeContext,
} from './ai.context';
import { buildChatPrompt, SYSTEM_INSTRUCTION } from './ai.prompts';
import { AIChatIntent, AIChatResult, AIContext, AIError } from './ai.types';
import { getProvider, emitAudit } from './ai.service';

/**
 * Deterministic lightweight intent routing.
 * Does not use machine learning; matches keywords.
 */
function determineIntent(message: string): AIChatIntent {
  const msg = message.toLowerCase();
  
  if (msg.includes('cost') || msg.includes('spend') || msg.includes('price') || msg.includes('billing') || msg.includes('expensive')) {
    return 'COST';
  }
  if (msg.includes('attack path') || msg.includes('reach') || msg.includes('lateral') || msg.includes('entry point')) {
    return 'ATTACK_PATH';
  }
  if (msg.includes('security') || msg.includes('vulnerabil') || msg.includes('finding') || msg.includes('exposed') || msg.includes('risk')) {
    return 'SECURITY';
  }
  if (msg.includes('resource') || msg.includes('ec2') || msg.includes('s3') || msg.includes('database') || msg.includes('instance')) {
    return 'RESOURCES';
  }
  if (msg.includes('overview') || msg.includes('summary') || msg.includes('health') || msg.includes('explain')) {
    return 'OVERVIEW';
  }
  if (msg.includes('weather') || msg.includes('python game') || msg.includes('bitcoin') || msg.includes('unrelated')) {
    return 'UNSUPPORTED';
  }
  
  return 'GENERAL';
}

/**
 * Validates chat source refs like "FINDING:123"
 */
function validateChatSourceRefs(sourceRefs: string[], ctx: AIContext): string[] {
  const validIds: Record<string, Set<string>> = {
    PROJECT: new Set([ctx.project.id]),
    ACCOUNT: new Set((ctx.accounts ?? []).map((a) => String(a.id))),
    RESOURCE: new Set((ctx.resources ?? []).map((r) => String(r.id))),
    FINDING: new Set((ctx.findings ?? []).map((f) => String(f.id))),
    ATTACK_PATH: new Set((ctx.attackPaths ?? []).map((ap) => String(ap.id))),
    RISK_SCORE: ctx.riskScore ? new Set(['1']) : new Set<string>(),
    COST: ctx.billing ? new Set([String(ctx.billing.accountId)]) : new Set<string>(),
    PRICING: new Set(['1']),
  };

  return sourceRefs.filter(ref => {
    const parts = ref.split(':');
    if (parts.length !== 2) return false;
    const type = parts[0];
    const id = parts[1];
    
    if (type === 'RISK_SCORE' || type === 'PRICING') return true;
    
    const validSet = validIds[type];
    return validSet && validSet.has(id);
  });
}

export async function runChat(
  projectId: string,
  userId: number,
  message: string
): Promise<AIChatResult> {
  const intent = determineIntent(message);
  const provider = getProvider();
  
  await emitAudit(projectId, userId, 'AI_CHAT_STARTED', {
    intent,
    provider: provider.providerName,
    model: provider.modelName,
  });

  try {
    if (intent === 'UNSUPPORTED') {
      const result: AIChatResult = {
        answer: "The AtherOps Cloud Assistant is focused on your AtherOps cloud environment. I cannot answer questions outside of this scope.",
        intent: 'UNSUPPORTED',
        severity: 'NONE',
        sourceRefs: [],
        limitations: []
      };
      await emitAudit(projectId, userId, 'AI_CHAT_COMPLETED', { intent, provider: provider.providerName, model: provider.modelName });
      return result;
    }

    let ctx: AIContext;
    switch (intent) {
      case 'COST':
        ctx = await buildProjectCostContext(projectId, userId);
        break;
      case 'ATTACK_PATH':
        ctx = await buildAttackPathContext(projectId, userId);
        break;
      case 'SECURITY':
      case 'RISK':
        ctx = await buildProjectSecurityContext(projectId, userId);
        break;
      case 'RESOURCES':
      case 'OVERVIEW':
      case 'GENERAL':
      default:
        ctx = await buildProjectOverviewContext(projectId, userId);
        break;
    }

    const contextText = serializeContext(ctx);
    const userPrompt = buildChatPrompt(contextText, message, intent);
    
    const result = await provider.generateChat({
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt,
    });
    
    // validate source refs
    const validRefs = validateChatSourceRefs(result.sourceRefs, ctx);
    if (validRefs.length < result.sourceRefs.length) {
      result.limitations.push('Some source references were removed due to validation failures.');
      result.sourceRefs = validRefs;
    }
    
    await emitAudit(projectId, userId, 'AI_CHAT_COMPLETED', { intent, provider: provider.providerName, model: provider.modelName });
    return result;
  } catch (err) {
    const code = err instanceof AIError ? err.code : 'PROVIDER_ERROR';
    await emitAudit(projectId, userId, 'AI_CHAT_FAILED', {
      intent,
      provider: provider.providerName,
      model: provider.modelName,
      errorCode: code,
    });
    logger.error('AI chat failed', { projectId, code });
    throw err;
  }
}
