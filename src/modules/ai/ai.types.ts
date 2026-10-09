/**
 * AtherOps – AI Module Types
 *
 * Provider-neutral interfaces for the AI Intelligence layer.
 * AI is an interpretation layer only. The database remains source of truth.
 */

// ── Source reference types ─────────────────────────────────────────────────

export type SourceRefType =
  | 'PROJECT'
  | 'ACCOUNT'
  | 'RESOURCE'
  | 'FINDING'
  | 'ATTACK_PATH'
  | 'RISK_SCORE'
  | 'COST'
  | 'PRICING';

export interface SourceRef {
  type: SourceRefType;
  id: string;
}

// ── Severity ───────────────────────────────────────────────────────────────

export type AISeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

// ── Structured AI output ───────────────────────────────────────────────────

export interface AIKeyInsight {
  title: string;
  description: string;
  severity: AISeverity;
  sourceRefs: SourceRef[];
}

export interface AIRecommendedAction {
  title: string;
  description: string;
  sourceRefs: SourceRef[];
}

export interface AIAnalysisResult {
  summary: string;
  keyInsights: AIKeyInsight[];
  recommendedActions: AIRecommendedAction[];
  limitations: string[];
}

// ── Operations ─────────────────────────────────────────────────────────────

export type AIOperation =
  | 'SECURITY_ANALYSIS'
  | 'PROJECT_OVERVIEW'
  | 'COST_ANALYSIS'
  | 'ATTACK_PATH_ANALYSIS';

// ── Provider interface ─────────────────────────────────────────────────────

export interface AIAnalysisInput {
  operation: AIOperation;
  systemInstruction: string;
  userPrompt: string;
}

export type AIChatIntent = 'OVERVIEW' | 'SECURITY' | 'COST' | 'RESOURCES' | 'ATTACK_PATH' | 'RISK' | 'GENERAL' | 'UNSUPPORTED';

export interface AIChatResult {
  answer: string;
  intent: AIChatIntent;
  severity: AISeverity | 'NONE';
  sourceRefs: string[];
  limitations: string[];
}

export interface AIChatInput {
  systemInstruction: string;
  userPrompt: string;
}

export interface AIProvider {
  generateAnalysis(input: AIAnalysisInput): Promise<AIAnalysisResult>;
  generateChat(input: AIChatInput): Promise<AIChatResult>;
  readonly providerName: string;
  readonly modelName: string;
}

// ── Context types ──────────────────────────────────────────────────────────

export interface AIProjectInfo {
  id: string;
  name: string;
  description?: string;
}

export interface AIAccountInfo {
  id: number;
  accountId: string;
  name: string;
  provider: string;
  region?: string;
  environment?: string;
  connectionState: string;
}

export interface AIResourceInfo {
  id: number;
  resourceType: string;
  resourceId: string;
  region?: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface AIFindingInfo {
  id: number;
  ruleCode: string;
  name: string;
  severity: string;
  status: string;
  resourceId?: number;
  resourceType?: string;
  resourceIdentifier?: string;
  category?: string;
  note?: string;
  createdAt?: string;
}

export interface AIAttackPathInfo {
  id: number;
  severity: string;
  description: string;
  findingChain: Array<{
    resourceId: string;
    resourceType: string;
    findingIds: string[];
  }>;
  createdAt?: string;
}

export interface AIRiskScoreInfo {
  securityScore?: number;
  costScore?: number;
  reliabilityScore?: number;
  complianceScore?: number;
  overallScore?: number;
  calculatedAt?: string;
}

export interface AIBillingInfo {
  accountId: number;
  currency: string;
  period: { start: string; end: string };
  totalCost: string;
  topServices: Array<{ service: string; amount: string; percentage: string }>;
  averageDailyCost?: string;
  highestCostDay?: { date: string; amount: string } | null;
}

export interface AIPricingInfo {
  category: string;
  region: string;
  pricingModel: string;
  hoursPerMonth?: number;
  providers: Array<{
    provider: string;
    available: boolean;
    estimatedMonthlyCost?: string;
    currency?: string;
    sku?: string;
  }>;
}

// ── AI Context ─────────────────────────────────────────────────────────────

export interface AIContext {
  project: AIProjectInfo;
  accounts?: AIAccountInfo[];
  resources?: AIResourceInfo[];
  findings?: AIFindingInfo[];
  attackPaths?: AIAttackPathInfo[];
  riskScore?: AIRiskScoreInfo;
  billing?: AIBillingInfo;
  pricing?: AIPricingInfo;
  contextLimitations?: string[];
}

// ── API Response ───────────────────────────────────────────────────────────

export interface AIAnalysisResponse {
  operation: AIOperation;
  model: string;
  provider: string;
  generatedAt: string;
  summary: string;
  keyInsights: AIKeyInsight[];
  recommendedActions: AIRecommendedAction[];
  limitations: string[];
}

// ── Error types ────────────────────────────────────────────────────────────

export type AIErrorCode =
  | 'AI_DISABLED'
  | 'API_KEY_MISSING'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'SAFETY_BLOCK'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'INVALID_SOURCE_REF'
  | 'CONTEXT_TOO_LARGE'
  | 'INVALID_SEVERITY';

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}
