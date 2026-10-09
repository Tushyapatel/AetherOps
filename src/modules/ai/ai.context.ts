/**
 * AtherOps – AI Context Builder
 *
 * Deterministically assembles verified AtherOps data into structured AI context.
 * Never invents data. Never sends sensitive values (passwords, tokens, keys).
 * Enforces context size limits per config.
 */

import { getPool } from '../../database';
import { config } from '../../config';
import { logger } from '../../logger';
import {
  AIContext,
  AIProjectInfo,
  AIAccountInfo,
  AIResourceInfo,
  AIFindingInfo,
  AIAttackPathInfo,
  AIBillingInfo,
} from './ai.types';

// ── Sensitive fields never sent to AI ────────────────────────────────────
const EXCLUDED_ACCOUNT_FIELDS = new Set([
  'role_arn', 'external_id', 'aws_access_key_id',
  'aws_secret_access_key', 'session_token',
]);

// ── Resource attribute sanitisation ──────────────────────────────────────
const SAFE_RESOURCE_ATTRIBUTES = new Set([
  'region', 'availability_zone', 'vpc_id', 'subnet_id',
  'public_ip_enabled', 'encryption_enabled', 'logging_enabled',
  'versioning_enabled', 'public_access', 'multi_az', 'engine',
  'instance_class', 'storage_gb', 'is_public',
]);

function sanitiseAttributes(
  raw: Record<string, unknown>
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!SAFE_RESOURCE_ATTRIBUTES.has(k)) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      safe[k] = v;
    }
  }
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes the AI context into a structured text block for the prompt.
 * Cloud metadata values are clearly labelled as DATA (not instructions).
 */
export function serializeContext(ctx: AIContext): string {
  const lines: string[] = [];

  // Project
  lines.push(`=== SOURCE: PROJECT | ID: ${ctx.project.id} ===`);
  lines.push(`NAME: ${ctx.project.name}`);
  if (ctx.project.description) {
    lines.push(`DESCRIPTION (UNTRUSTED DATA): ${ctx.project.description}`);
  }
  lines.push('');

  // Accounts
  if (ctx.accounts && ctx.accounts.length > 0) {
    lines.push('=== ACCOUNTS ===');
    for (const acct of ctx.accounts) {
      lines.push(`SOURCE: ACCOUNT | ID: ${acct.id}`);
      lines.push(`  PROVIDER: ${acct.provider}`);
      lines.push(`  ACCOUNT_IDENTIFIER (UNTRUSTED DATA): ${acct.accountId}`);
      lines.push(`  NAME (UNTRUSTED DATA): ${acct.name}`);
      if (acct.region) lines.push(`  REGION: ${acct.region}`);
      if (acct.environment) lines.push(`  ENVIRONMENT: ${acct.environment}`);
      lines.push(`  CONNECTION_STATE: ${acct.connectionState}`);
    }
    lines.push('');
  }

  // Findings
  if (ctx.findings && ctx.findings.length > 0) {
    lines.push('=== SECURITY FINDINGS ===');
    for (const f of ctx.findings) {
      lines.push(`SOURCE: FINDING | ID: ${f.id}`);
      lines.push(`  RULE: ${f.ruleCode}`);
      lines.push(`  NAME: ${f.name}`);
      lines.push(`  SEVERITY: ${f.severity}`);
      lines.push(`  STATUS: ${f.status}`);
      if (f.resourceType) lines.push(`  RESOURCE_TYPE: ${f.resourceType}`);
      if (f.resourceId) lines.push(`  RESOURCE_ID: ${f.resourceId}`);
      if (f.category) lines.push(`  CATEGORY: ${f.category}`);
      // Note is untrusted cloud data
      if (f.note) lines.push(`  NOTE (UNTRUSTED DATA): ${f.note}`);
      if (f.createdAt) lines.push(`  DETECTED_AT: ${f.createdAt}`);
    }
    lines.push('');
  }

  // Resources
  if (ctx.resources && ctx.resources.length > 0) {
    lines.push('=== RESOURCES ===');
    for (const r of ctx.resources) {
      lines.push(`SOURCE: RESOURCE | ID: ${r.id}`);
      lines.push(`  RESOURCE_TYPE: ${r.resourceType}`);
      lines.push(`  RESOURCE_IDENTIFIER (UNTRUSTED DATA): ${r.resourceId}`);
      if (r.region) lines.push(`  REGION: ${r.region}`);
      if (r.attributes && Object.keys(r.attributes).length > 0) {
        lines.push(`  ATTRIBUTES: ${JSON.stringify(r.attributes)}`);
      }
    }
    lines.push('');
  }

  // Attack Paths
  if (ctx.attackPaths && ctx.attackPaths.length > 0) {
    lines.push('=== ATTACK PATHS ===');
    for (const ap of ctx.attackPaths) {
      lines.push(`SOURCE: ATTACK_PATH | ID: ${ap.id}`);
      lines.push(`  SEVERITY: ${ap.severity}`);
      lines.push(`  DESCRIPTION (UNTRUSTED DATA): ${ap.description}`);
      lines.push(`  FINDING_CHAIN:`);
      for (const step of ap.findingChain) {
        lines.push(`    - RESOURCE_TYPE: ${step.resourceType} | RESOURCE_ID (UNTRUSTED DATA): ${step.resourceId} | FINDING_IDS: ${step.findingIds.join(', ')}`);
      }
      if (ap.createdAt) lines.push(`  DETECTED_AT: ${ap.createdAt}`);
    }
    lines.push('');
  }

  // Risk Score
  if (ctx.riskScore) {
    lines.push('=== SOURCE: RISK_SCORE ===');
    if (ctx.riskScore.securityScore !== null && ctx.riskScore.securityScore !== undefined) lines.push(`  SECURITY_SCORE: ${ctx.riskScore.securityScore}`);
    if (ctx.riskScore.costScore !== null && ctx.riskScore.costScore !== undefined) lines.push(`  COST_SCORE: ${ctx.riskScore.costScore}`);
    if (ctx.riskScore.reliabilityScore !== null && ctx.riskScore.reliabilityScore !== undefined) lines.push(`  RELIABILITY_SCORE: ${ctx.riskScore.reliabilityScore}`);
    if (ctx.riskScore.complianceScore !== null && ctx.riskScore.complianceScore !== undefined) lines.push(`  COMPLIANCE_SCORE: ${ctx.riskScore.complianceScore}`);
    if (ctx.riskScore.overallScore !== null && ctx.riskScore.overallScore !== undefined) lines.push(`  OVERALL_SCORE: ${ctx.riskScore.overallScore}`);
    if (ctx.riskScore.calculatedAt) lines.push(`  CALCULATED_AT: ${ctx.riskScore.calculatedAt}`);
    lines.push('');
  }

  // Billing (Actual AWS Spend)
  if (ctx.billing) {
    lines.push('=== SOURCE: COST (ACTUAL AWS BILLING — Phase 9) ===');
    lines.push(`  ACCOUNT_ID: ${ctx.billing.accountId}`);
    lines.push(`  CURRENCY: ${ctx.billing.currency}`);
    lines.push(`  PERIOD: ${ctx.billing.period.start} to ${ctx.billing.period.end}`);
    lines.push(`  TOTAL_ACTUAL_COST: ${ctx.billing.totalCost} ${ctx.billing.currency}`);
    if (ctx.billing.averageDailyCost) lines.push(`  AVERAGE_DAILY_COST: ${ctx.billing.averageDailyCost} ${ctx.billing.currency}`);
    if (ctx.billing.highestCostDay) {
      lines.push(`  HIGHEST_COST_DAY: ${ctx.billing.highestCostDay.date} (${ctx.billing.highestCostDay.amount} ${ctx.billing.currency})`);
    }
    if (ctx.billing.topServices.length > 0) {
      lines.push('  TOP_COST_SERVICES (ACTUAL SPEND):');
      for (const svc of ctx.billing.topServices) {
        lines.push(`    - SERVICE: ${svc.service} | AMOUNT: ${svc.amount} ${ctx.billing.currency} | SHARE: ${svc.percentage}%`);
      }
    }
    lines.push('');
  }

  // Pricing (Catalog Estimates)
  if (ctx.pricing) {
    lines.push('=== SOURCE: PRICING (ESTIMATED CATALOG PRICING — Phase 10) ===');
    lines.push('  NOTE: These are catalog price estimates for equivalent workloads, NOT actual spend.');
    lines.push(`  CATEGORY: ${ctx.pricing.category}`);
    lines.push(`  REGION: ${ctx.pricing.region}`);
    lines.push(`  PRICING_MODEL: ${ctx.pricing.pricingModel}`);
    if (ctx.pricing.hoursPerMonth) lines.push(`  ASSUMPTION_HOURS_PER_MONTH: ${ctx.pricing.hoursPerMonth}`);
    for (const p of ctx.pricing.providers) {
      if (p.available) {
        lines.push(`  PROVIDER: ${p.provider} | ESTIMATED_MONTHLY_COST: ${p.estimatedMonthlyCost} ${p.currency ?? 'USD'} | SKU: ${p.sku ?? 'N/A'}`);
      } else {
        lines.push(`  PROVIDER: ${p.provider} | UNAVAILABLE`);
      }
    }
    lines.push('');
  }

  // Context limitations
  if (ctx.contextLimitations && ctx.contextLimitations.length > 0) {
    lines.push('=== CONTEXT LIMITATIONS ===');
    for (const lim of ctx.contextLimitations) {
      lines.push(`  - ${lim}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Builders
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProject(projectId: string, userId: number): Promise<AIProjectInfo | null> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id::text, name, description FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return { id: row.id, name: row.name, description: row.description };
}

async function fetchAccounts(projectId: string): Promise<AIAccountInfo[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, account_id, account_name as name, provider, region, environment, mode as connection_state
     FROM cloud_accounts WHERE project_id = $1`,
    [projectId]
  );
  return res.rows.map((r: Record<string, string>) => ({
    id: Number(r.id),
    accountId: r.account_id,
    name: r.name,
    provider: r.provider,
    region: r.region,
    environment: r.environment,
    connectionState: r.connection_state,
    // Sensitive fields (role_arn, external_id) are intentionally excluded
    ...Object.fromEntries(
      Object.entries(r).filter(([k]) => !EXCLUDED_ACCOUNT_FIELDS.has(k))
    ),
  })).map((r) => ({
    id: r.id as number,
    accountId: r.accountId as string,
    name: r.name as string,
    provider: r.provider as string,
    region: r.region as string | undefined,
    environment: r.environment as string | undefined,
    connectionState: r.connectionState as string,
  }));
}

async function fetchFindings(projectId: string, limit: number): Promise<{ findings: AIFindingInfo[]; truncated: boolean }> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT f.id, fr.rule_code, fr.name as rule_name, f.severity, f.status,
            f.resource_id, r.resource_type, r.resource_id as resource_identifier,
            fr.category, f.note,
            TO_CHAR(f.created_at, 'YYYY-MM-DD') as created_at
     FROM findings f
     JOIN finding_rules fr ON f.rule_id = fr.rule_code
     JOIN cloud_accounts ca ON f.account_id = ca.id
     LEFT JOIN resources r ON f.resource_id = r.id
     WHERE ca.project_id = $1
       AND f.status = 'OPEN'
     ORDER BY 
       CASE f.severity
         WHEN 'CRITICAL' THEN 1
         WHEN 'HIGH' THEN 2
         WHEN 'MEDIUM' THEN 3
         WHEN 'LOW' THEN 4
         ELSE 5
       END ASC,
       f.created_at DESC
     LIMIT $2`,
    [projectId, limit + 1]
  );

  const truncated = res.rows.length > limit;
  const rows = truncated ? res.rows.slice(0, limit) : res.rows;

  return {
    findings: rows.map((r: Record<string, string | number | null>) => ({
      id: Number(r.id),
      ruleCode: String(r.rule_code),
      name: String(r.rule_name),
      severity: String(r.severity),
      status: String(r.status),
      resourceId: r.resource_id ? Number(r.resource_id) : undefined,
      resourceType: r.resource_type ? String(r.resource_type) : undefined,
      resourceIdentifier: r.resource_identifier ? String(r.resource_identifier) : undefined,
      category: r.category ? String(r.category) : undefined,
      note: r.note ? String(r.note) : undefined,
      createdAt: r.created_at ? String(r.created_at) : undefined,
    })),
    truncated,
  };
}

async function fetchResources(projectId: string, limit: number): Promise<{ resources: AIResourceInfo[]; truncated: boolean }> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT r.id, r.resource_type, r.resource_id, r.region, r.attributes
     FROM resources r
     JOIN cloud_accounts ca ON r.account_id = ca.id
     WHERE ca.project_id = $1
     ORDER BY r.resource_type ASC, r.id ASC
     LIMIT $2`,
    [projectId, limit + 1]
  );

  const truncated = res.rows.length > limit;
  const rows = truncated ? res.rows.slice(0, limit) : res.rows;

  return {
    resources: rows.map((r: Record<string, unknown>) => {
      let attributes: Record<string, string | number | boolean> = {};
      try {
        const raw = typeof r.attributes === 'string' ? JSON.parse(r.attributes) : (r.attributes ?? {});
        attributes = sanitiseAttributes(raw as Record<string, unknown>);
      } catch {
        // ignore parse errors
      }
      return {
        id: Number(r.id),
        resourceType: String(r.resource_type),
        resourceId: String(r.resource_id),
        region: r.region ? String(r.region) : undefined,
        attributes,
      };
    }),
    truncated,
  };
}

async function fetchAttackPaths(projectId: string, limit: number): Promise<{ attackPaths: AIAttackPathInfo[]; truncated: boolean }> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT ap.id, ap.severity, ap.description, ap.finding_chain,
            TO_CHAR(ap.created_at, 'YYYY-MM-DD') as created_at
     FROM attack_paths ap
     JOIN cloud_accounts ca ON ap.account_id = ca.id
     WHERE ca.project_id = $1
     ORDER BY 
       CASE ap.severity
         WHEN 'CRITICAL' THEN 1
         WHEN 'HIGH' THEN 2
         WHEN 'MEDIUM' THEN 3
         WHEN 'LOW' THEN 4
         ELSE 5
       END ASC,
       ap.created_at DESC
     LIMIT $2`,
    [projectId, limit + 1]
  );

  const truncated = res.rows.length > limit;
  const rows = truncated ? res.rows.slice(0, limit) : res.rows;

  return {
    attackPaths: rows.map((r: Record<string, unknown>) => {
      let findingChain: AIAttackPathInfo['findingChain'] = [];
      try {
        const raw = typeof r.finding_chain === 'string'
          ? JSON.parse(r.finding_chain)
          : (r.finding_chain ?? []);
        findingChain = Array.isArray(raw) ? raw : [];
      } catch {
        // ignore parse errors
      }
      return {
        id: Number(r.id),
        severity: String(r.severity),
        description: String(r.description ?? ''),
        findingChain,
        createdAt: r.created_at ? String(r.created_at) : undefined,
      };
    }),
    truncated,
  };
}

async function fetchRiskScore(projectId: string) {
  const pool = getPool();
  // Risk scores stored in project_risk_scores table if it exists
  try {
    const res = await pool.query(
      `SELECT security_score, cost_score, reliability_score, compliance_score,
              overall_score, TO_CHAR(calculated_at, 'YYYY-MM-DD') as calculated_at
       FROM project_risk_scores WHERE project_id = $1
       ORDER BY calculated_at DESC LIMIT 1`,
      [projectId]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      securityScore: r.security_score !== null && r.security_score !== undefined ? Number(r.security_score) : undefined,
      costScore: r.cost_score !== null && r.cost_score !== undefined ? Number(r.cost_score) : undefined,
      reliabilityScore: r.reliability_score !== null && r.reliability_score !== undefined ? Number(r.reliability_score) : undefined,
      complianceScore: r.compliance_score !== null && r.compliance_score !== undefined ? Number(r.compliance_score) : undefined,
      overallScore: r.overall_score !== null && r.overall_score !== undefined ? Number(r.overall_score) : undefined,
      calculatedAt: r.calculated_at,
    };
  } catch {
    // Table may not exist — not a fatal error
    return undefined;
  }
}

async function fetchBillingSummary(projectId: string): Promise<AIBillingInfo | undefined> {
  const pool = getPool();
  try {
    // Get most recent 30-day costs per service for any account in this project
    const res = await pool.query(
      `SELECT c.account_id,
              c.service_name,
              SUM(c.amount::numeric) as total,
              c.currency
       FROM costs c
       JOIN cloud_accounts ca ON c.account_id = ca.id
       WHERE ca.project_id = $1
         AND c.granularity = 'MONTHLY'
         AND c.metric = 'UnblendedCost'
       GROUP BY c.account_id, c.service_name, c.currency
       ORDER BY total DESC
       LIMIT 10`,
      [projectId]
    );

    if (res.rows.length === 0) return undefined;

    const currency = String(res.rows[0].currency);
    const accountId = Number(res.rows[0].account_id);
    const totalCost = res.rows.reduce((sum: number, r: Record<string, string>) => sum + Number(r.total), 0).toFixed(2);
    const topServices = res.rows.map((r: Record<string, string | number>) => ({
      service: String(r.service_name),
      amount: Number(r.total).toFixed(2),
      percentage: totalCost !== '0.00'
        ? ((Number(r.total) / Number(totalCost)) * 100).toFixed(1)
        : '0.0',
    }));

    return {
      accountId,
      currency,
      period: { start: 'last 30 days', end: 'now' },
      totalCost,
      topServices,
    };
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public context builder functions
// ─────────────────────────────────────────────────────────────────────────────

export async function buildProjectSecurityContext(
  projectId: string,
  userId: number
): Promise<AIContext> {
  const limitations: string[] = [];

  const project = await fetchProject(projectId, userId);
  if (!project) throw new Error('Project not found');

  const accounts = await fetchAccounts(projectId);
  const maxFindings = config.ai.context.maxFindings;
  const maxResources = config.ai.context.maxResources;
  const maxPaths = config.ai.context.maxAttackPaths;

  const { findings, truncated: findingsTruncated } = await fetchFindings(projectId, maxFindings);
  const { resources, truncated: resourcesTruncated } = await fetchResources(projectId, maxResources);
  const { attackPaths, truncated: pathsTruncated } = await fetchAttackPaths(projectId, maxPaths);

  if (findingsTruncated) limitations.push(`Only the top ${maxFindings} open findings are included. Additional findings exist.`);
  if (resourcesTruncated) limitations.push(`Only ${maxResources} resources included. Additional resources exist.`);
  if (pathsTruncated) limitations.push(`Only the top ${maxPaths} attack paths are included.`);

  const riskScore = await fetchRiskScore(projectId);

  logger.info('AI security context built', {
    projectId,
    findingCount: findings.length,
    resourceCount: resources.length,
    attackPathCount: attackPaths.length,
  });

  return { project, accounts, findings, resources, attackPaths, riskScore, contextLimitations: limitations };
}

export async function buildProjectOverviewContext(
  projectId: string,
  userId: number
): Promise<AIContext> {
  const limitations: string[] = [];

  const project = await fetchProject(projectId, userId);
  if (!project) throw new Error('Project not found');

  const accounts = await fetchAccounts(projectId);
  const { findings, truncated: findingsTruncated } = await fetchFindings(projectId, 10);
  const { attackPaths, truncated: pathsTruncated } = await fetchAttackPaths(projectId, 5);

  if (findingsTruncated) limitations.push(`Only top 10 findings shown for overview.`);
  if (pathsTruncated) limitations.push(`Only top 5 attack paths shown for overview.`);

  const riskScore = await fetchRiskScore(projectId);
  const billing = await fetchBillingSummary(projectId);
  if (!billing) limitations.push('No billing data available for this project.');

  return { project, accounts, findings, attackPaths, riskScore, billing, contextLimitations: limitations };
}

export async function buildProjectCostContext(
  projectId: string,
  userId: number
): Promise<AIContext> {
  const limitations: string[] = [];

  const project = await fetchProject(projectId, userId);
  if (!project) throw new Error('Project not found');

  const accounts = await fetchAccounts(projectId);
  const billing = await fetchBillingSummary(projectId);
  if (!billing) limitations.push('No billing data available. Run a billing query first to populate costs.');

  return { project, accounts, billing, contextLimitations: limitations };
}

export async function buildAttackPathContext(
  projectId: string,
  userId: number
): Promise<AIContext> {
  const limitations: string[] = [];

  const project = await fetchProject(projectId, userId);
  if (!project) throw new Error('Project not found');

  const accounts = await fetchAccounts(projectId);
  const maxPaths = config.ai.context.maxAttackPaths;
  const { attackPaths, truncated: pathsTruncated } = await fetchAttackPaths(projectId, maxPaths);
  const { findings, truncated: findingsTruncated } = await fetchFindings(projectId, config.ai.context.maxFindings);

  if (pathsTruncated) limitations.push(`Only the top ${maxPaths} attack paths are included.`);
  if (findingsTruncated) limitations.push(`Only the top ${config.ai.context.maxFindings} findings included.`);

  if (attackPaths.length === 0) limitations.push('No attack paths exist for this project. Run attack-path correlation first.');

  return { project, accounts, attackPaths, findings, contextLimitations: limitations };
}

/**
 * Validate that all sourceRefs in the AI result reference IDs that exist in the context.
 * Prevents model from inventing source IDs.
 */
export function validateSourceRefs(
  result: { keyInsights: Array<{ sourceRefs: Array<{ type: string; id: string }> }>; recommendedActions: Array<{ sourceRefs: Array<{ type: string; id: string }> }> },
  ctx: AIContext
): string[] {
  const errors: string[] = [];

  // Build ID sets from context
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

  const allRefs = [
    ...result.keyInsights.flatMap((i) => i.sourceRefs),
    ...result.recommendedActions.flatMap((a) => a.sourceRefs),
  ];

  for (const ref of allRefs) {
    const validSet = validIds[ref.type];
    if (!validSet) {
      errors.push(`Unknown sourceRef type: ${ref.type}`);
      continue;
    }
    // For RISK_SCORE, PRICING — any ID is OK since they're singletons
    if (ref.type === 'RISK_SCORE' || ref.type === 'PRICING') continue;
    if (!validSet.has(ref.id)) {
      errors.push(`sourceRef ${ref.type}:${ref.id} not found in context`);
    }
  }

  return errors;
}
