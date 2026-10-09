/**
 * AtherOps – AI Controller
 *
 * HTTP handlers for all AI operations.
 * Authenticates, verifies project ownership, calls service, returns safe response.
 * Never exposes: API keys, prompts, system instructions, raw AI output.
 */

import { Request, Response } from 'express';
import { getProject } from '../../api/v1/projects/project.service';
import { NotFoundError } from '../../errors';
import { logger } from '../../logger';
import {
  runSecurityAnalysis,
  runProjectOverview,
  runCostAnalysis,
  runAttackPathAnalysis,
} from './ai.service';
import { runChat } from './ai.chat';
import { AIError } from './ai.types';

// ── ID validation ────────────────────────────────────────────────────────

const PROJECT_ID_RE = /^\d+$/;

function validateProjectId(projectId: string): boolean {
  return PROJECT_ID_RE.test(projectId);
}

// ── Error → HTTP response ──────────────────────────────────────────────────

function handleAIError(err: unknown, res: Response): void {
  if (err instanceof AIError) {
    switch (err.code) {
      case 'AI_DISABLED':
        res.status(503).json({ success: false, error: { code: err.code, message: 'AI analysis is currently disabled.' } });
        return;
      case 'API_KEY_MISSING':
        res.status(503).json({ success: false, error: { code: err.code, message: 'AI provider is not configured.' } });
        return;
      case 'PROVIDER_TIMEOUT':
        res.status(504).json({ success: false, error: { code: err.code, message: 'AI provider timed out. Please retry.' } });
        return;
      case 'PROVIDER_RATE_LIMIT':
        res.status(429).json({ success: false, error: { code: err.code, message: 'AI provider rate limit reached. Please retry later.' } });
        return;
      case 'SAFETY_BLOCK':
        res.status(422).json({ success: false, error: { code: err.code, message: 'AI request was blocked by safety filters.' } });
        return;
      case 'SCHEMA_VALIDATION_FAILED':
        res.status(502).json({ success: false, error: { code: err.code, message: 'AI provider returned an invalid response.' } });
        return;
      default:
        res.status(502).json({ success: false, error: { code: err.code, message: 'AI provider error.' } });
        return;
    }
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ success: false, error: { message: 'Project not found or access denied.' } });
    return;
  }

  logger.error('Unhandled AI controller error', { error: err });
  res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
}

// ── Common project verification ────────────────────────────────────────────

async function verifyProjectAccess(
  req: Request,
  res: Response
): Promise<{ projectId: string; userId: number } | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { message: 'Unauthorized.' } });
    return null;
  }

  const rawId = req.params['projectId'];
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!projectId || !validateProjectId(projectId)) {
    res.status(400).json({ success: false, error: { message: 'Invalid projectId format.' } });
    return null;
  }

  try {
    await getProject(projectId, userId);
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ success: false, error: { message: 'Project not found or access denied.' } });
      return null;
    }
    throw err;
  }

  return { projectId, userId };
}

// ── Controllers ────────────────────────────────────────────────────────────

export async function securityAnalysisController(req: Request, res: Response): Promise<void> {
  try {
    const access = await verifyProjectAccess(req, res);
    if (!access) return;

    const result = await runSecurityAnalysis(access.projectId, access.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleAIError(err, res);
  }
}

export async function projectOverviewController(req: Request, res: Response): Promise<void> {
  try {
    const access = await verifyProjectAccess(req, res);
    if (!access) return;

    const result = await runProjectOverview(access.projectId, access.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleAIError(err, res);
  }
}

export async function costAnalysisController(req: Request, res: Response): Promise<void> {
  try {
    const access = await verifyProjectAccess(req, res);
    if (!access) return;

    const result = await runCostAnalysis(access.projectId, access.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleAIError(err, res);
  }
}

export async function attackPathAnalysisController(req: Request, res: Response): Promise<void> {
  try {
    const access = await verifyProjectAccess(req, res);
    if (!access) return;

    const result = await runAttackPathAnalysis(access.projectId, access.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleAIError(err, res);
  }
}

export async function chatController(req: Request, res: Response): Promise<void> {
  try {
    const access = await verifyProjectAccess(req, res);
    if (!access) return;

    let { message } = req.body;
    
    if (typeof message !== 'string') {
      res.status(400).json({ success: false, error: { message: 'Message must be a string' } });
      return;
    }

    message = message.trim();

    if (message.length < 1) {
      res.status(400).json({ success: false, error: { message: 'Message cannot be empty' } });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({ success: false, error: { message: 'Message is too long (maximum 2000 characters)' } });
      return;
    }

    const result = await runChat(access.projectId, access.userId, message);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleAIError(err, res);
  }
}
