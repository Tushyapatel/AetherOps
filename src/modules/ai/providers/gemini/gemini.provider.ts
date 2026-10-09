/**
 * AtherOps – Gemini AI Provider
 *
 * Implements AIProvider using @google/genai v2.x.
 * Model is configured via config.ai.model — never hard-coded.
 * API keys loaded from config — never logged, never returned in responses.
 * Implements legitimate failover mechanism across up to 4 configured API keys.
 */

import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  AIAnalysisInput,
  AIAnalysisResult,
  AIError,
  AIChatInput,
  AIChatResult,
} from '../../ai.types';
import { AIAnalysisResultSchema, GEMINI_RESPONSE_SCHEMA, AIChatResultSchema, GEMINI_CHAT_RESPONSE_SCHEMA } from '../../ai.schemas';
import { logger } from '../../../../logger';

interface KeySlot {
  index: number;
  id: string; // e.g., KEY_1
  key: string;
  unavailableUntil: number | null;
  client: GoogleGenAI;
}

export class GeminiProvider implements AIProvider {
  readonly providerName = 'gemini';
  readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly keyCooldownMs: number;
  private keySlots: KeySlot[] = [];

  constructor(apiKeys: string[], modelName: string, timeoutMs = 30000, maxRetries = 2, keyCooldownSeconds = 900) {
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.keyCooldownMs = keyCooldownSeconds * 1000;

    apiKeys.slice(0, 4).forEach((key, idx) => {
      this.keySlots.push({
        index: idx,
        id: `KEY_${idx + 1}`,
        key,
        unavailableUntil: null,
        client: new GoogleGenAI({ apiKey: key })
      });
    });

    if (this.keySlots.length === 0) {
      // In case array was empty
      throw new AIError('API_KEY_MISSING', 'No Gemini API keys configured', false);
    }
  }

  private getAvailableKeySlot(): KeySlot {
    const now = Date.now();
    for (const slot of this.keySlots) {
      if (!slot.unavailableUntil || now > slot.unavailableUntil) {
        // Reset if cooldown passed
        slot.unavailableUntil = null;
        return slot;
      }
    }
    throw new AIError('PROVIDER_UNAVAILABLE', 'All Gemini keys are currently exhausted or unavailable.', false);
  }

  private markKeyUnavailable(slot: KeySlot, reason: string): void {
    slot.unavailableUntil = Date.now() + this.keyCooldownMs;
    logger.warn(`Gemini API key marked unavailable`, {
      keySlot: slot.id,
      reason,
      cooldownSeconds: this.keyCooldownMs / 1000
    });
  }

  private isFailoverEligible(errMessage: string): { eligible: boolean; reason: string } {
    if (errMessage.includes('RATE_LIMIT_EXCEEDED') || errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED')) {
      return { eligible: true, reason: 'QUOTA_EXHAUSTED' };
    }
    if (errMessage.includes('503') || errMessage.includes('UNAVAILABLE') || errMessage.includes('high demand')) {
      return { eligible: true, reason: 'PROVIDER_OVERLOADED' };
    }
    if (errMessage.includes('API_KEY') || errMessage.includes('401') || errMessage.includes('403')) {
      return { eligible: true, reason: 'AUTH_FAILED' };
    }
    return { eligible: false, reason: '' };
  }

  async generateAnalysis(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    let lastError: AIError | null = null;
    let attempt = 0;
    let fallbackLoop = 0;
    const maxAttempts = this.keySlots.length; // Max attempts bounded by key count

    while (fallbackLoop < maxAttempts) {
      fallbackLoop++;
      attempt++;
      const slot = this.getAvailableKeySlot();      try {
        const result = await this.callGemini(input, slot);
        
        // Audit success
        logger.info('GEMINI_REQUEST_SUCCESS', {
          operation: input.operation,
          model: this.modelName,
          keySlot: slot.id,
          attempt,
          failover: attempt > 1
        });

        return result;
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const { eligible, reason } = this.isFailoverEligible(errMessage);

        if (eligible) {
          this.markKeyUnavailable(slot, reason);
          lastError = new AIError('PROVIDER_UNAVAILABLE', `Key ${slot.id} unavailable: ${reason}`, true);
          
          if (fallbackLoop >= maxAttempts) {
            break;
          }
          // Immediate failover, no sleep required for quota/auth failover
          continue;
        }

        // For non-failover errors (e.g. timeout, schema), rely on standard retry logic
        if (err instanceof AIError) {
          if (!err.retryable || attempt > this.maxRetries) {
            throw err;
          }
          lastError = err;
          logger.warn(`Gemini transient error, retrying`, {
            keySlot: slot.id,
            code: err.code,
            message: err.message,
          });
          await sleep(Math.pow(2, attempt) * 500);
          fallbackLoop--; // standard retry, don't consume a failover loop iteration
        } else {
          console.error('[GeminiProvider] Unexpected error:', err);
          throw new AIError('PROVIDER_ERROR', 'Unexpected provider error', false);
        }
      }
    }

    throw lastError ?? new AIError('PROVIDER_ERROR', 'AI provider failed after retries', false);
  }

  async generateChat(input: AIChatInput): Promise<AIChatResult> {
    let lastError: AIError | null = null;
    let attempt = 0;
    let fallbackLoop = 0;
    const maxAttempts = this.keySlots.length;

    while (fallbackLoop < maxAttempts) {
      fallbackLoop++;
      attempt++;
      const slot = this.getAvailableKeySlot();

      try {
        const result = await this.callGeminiChat(input, slot);

        logger.info('GEMINI_REQUEST_SUCCESS', {
          operation: 'AI_CHAT',
          model: this.modelName,
          keySlot: slot.id,
          attempt,
          failover: attempt > 1
        });

        return result;
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const { eligible, reason } = this.isFailoverEligible(errMessage);

        if (eligible) {
          this.markKeyUnavailable(slot, reason);
          lastError = new AIError('PROVIDER_UNAVAILABLE', `Key ${slot.id} unavailable: ${reason}`, true);
          
          if (fallbackLoop >= maxAttempts) {
            break;
          }
          continue;
        }

        if (err instanceof AIError) {
          if (!err.retryable || attempt > this.maxRetries) {
            throw err;
          }
          lastError = err;
          logger.warn(`Gemini transient error, retrying chat`, {
            keySlot: slot.id,
            code: err.code,
            message: err.message,
          });
          await sleep(Math.pow(2, attempt) * 500);
          fallbackLoop--;
        } else {
          throw new AIError('PROVIDER_ERROR', 'Unexpected provider error', false);
        }
      }
    }

    throw lastError ?? new AIError('PROVIDER_ERROR', 'AI provider failed after retries', false);
  }

  private async callGemini(input: AIAnalysisInput, slot: KeySlot): Promise<AIAnalysisResult> {
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), this.timeoutMs);

    try {
      const response = await slot.client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: input.userPrompt }],
          },
        ],
        config: {
          systemInstruction: input.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA as any,
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      clearTimeout(timeoutHandle);

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new AIError('PROVIDER_ERROR', 'No candidates returned from Gemini', false);
      }
      if (candidate.finishReason === 'SAFETY') {
        throw new AIError('SAFETY_BLOCK', 'Gemini safety filter triggered', false);
      }

      const rawText = response.text;
      if (!rawText) {
        throw new AIError('PROVIDER_ERROR', 'Empty response from Gemini', false);
      }

      return this.parseAndValidate(rawText);
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (err instanceof AIError) throw err;

      const errMessage = err instanceof Error ? err.message : String(err);
      
      if (errMessage.includes('aborted') || errMessage.includes('timeout') || errMessage.includes('DEADLINE')) {
        throw new AIError('PROVIDER_TIMEOUT', `Gemini request timed out after ${this.timeoutMs}ms`, true);
      }

      // Re-throw with cause so the calling loop can inspect failover eligibility
      throw new Error(errMessage, { cause: err });
    }
  }

  private parseAndValidate(rawText: string): AIAnalysisResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new AIError('SCHEMA_VALIDATION_FAILED', 'Gemini response is not valid JSON', false);
    }
    const validation = AIAnalysisResultSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map(i => i.message).join('; ');
      logger.warn('Gemini structured output failed schema validation', { issues });
      throw new AIError('SCHEMA_VALIDATION_FAILED', `Schema validation failed: ${issues}`, false);
    }
    return validation.data;
  }

  private async callGeminiChat(input: AIChatInput, slot: KeySlot): Promise<AIChatResult> {
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), this.timeoutMs);

    try {
      const response = await slot.client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: input.userPrompt }],
          },
        ],
        config: {
          systemInstruction: input.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_CHAT_RESPONSE_SCHEMA as any,
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      clearTimeout(timeoutHandle);

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new AIError('PROVIDER_ERROR', 'No candidates returned from Gemini', false);
      }
      if (candidate.finishReason === 'SAFETY') {
        throw new AIError('SAFETY_BLOCK', 'Gemini safety filter triggered', false);
      }

      const rawText = response.text;
      if (!rawText) {
        throw new AIError('PROVIDER_ERROR', 'Empty response from Gemini', false);
      }

      return this.parseAndValidateChat(rawText);
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (err instanceof AIError) throw err;

      const errMessage = err instanceof Error ? err.message : String(err);
      
      if (errMessage.includes('aborted') || errMessage.includes('timeout') || errMessage.includes('DEADLINE')) {
        throw new AIError('PROVIDER_TIMEOUT', `Gemini request timed out after ${this.timeoutMs}ms`, true);
      }

      throw new Error(errMessage, { cause: err });
    }
  }

  private parseAndValidateChat(rawText: string): AIChatResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new AIError('SCHEMA_VALIDATION_FAILED', 'Gemini response is not valid JSON', false);
    }
    const validation = AIChatResultSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map(i => i.message).join('; ');
      logger.warn('Gemini chat output failed schema validation', { issues });
      throw new AIError('SCHEMA_VALIDATION_FAILED', `Schema validation failed: ${issues}`, false);
    }
    return validation.data;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
