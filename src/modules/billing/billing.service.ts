import { fetchAwsBillingData } from './aws/cost-explorer.client';
import { normalizeAwsCostData } from './normalizers/cost.normalizer';
import { upsertCosts, fetchCosts } from './billing.repository';
import { BillingQuery, BillingResponse, NormalizedCostRecord } from './billing.types';
import { findCloudAccountById } from '../../api/v1/cloud-accounts/cloudAccount.repository';
import { logger } from '../../logger';
import { getPool } from '../../database';

export async function processBillingQuery(
  userId: number,
  projectId: string,
  cloudAccountId: number,
  query: BillingQuery
): Promise<BillingResponse> {
  const cloudAccount = await findCloudAccountById(cloudAccountId, projectId, userId);
  if (!cloudAccount) {
    const error: any = new Error('Not Found');
    error.status = 404;
    throw error;
  }

  const metric = 'UnblendedCost';
  
  if (cloudAccount.mode === 'DEMO') {
    await getPool().query(
      `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, 'BILLING_QUERY_COMPLETED', 'CLOUD_ACCOUNT', $3, $4, CURRENT_TIMESTAMP)`,
      [
        projectId,
        userId,
        cloudAccountId,
        JSON.stringify({ mode: 'DEMO' })
      ]
    );
    logger.info('BILLING_QUERY_COMPLETED', { projectId, cloudAccountId, mode: 'DEMO' });
    return getDemoBillingResponse(cloudAccountId, query);
  }

  if (!cloudAccount.role_arn || !cloudAccount.external_id) {
    const error: any = new Error('Cloud account is missing IAM Role ARN or External ID');
    error.status = 400;
    throw error;
  }

  await getPool().query(
    `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, $2, 'BILLING_QUERY_STARTED', 'CLOUD_ACCOUNT', $3, $4, CURRENT_TIMESTAMP)`,
    [
      projectId,
      userId,
      cloudAccountId,
      JSON.stringify({ period: `${query.startDate}-${query.endDate}`, granularity: query.granularity })
    ]
  );

  logger.info('BILLING_QUERY_STARTED', { 
    projectId, cloudAccountId, period: `${query.startDate}-${query.endDate}`, granularity: query.granularity 
  });

  try {
    const awsData = await fetchAwsBillingData(
      cloudAccount.role_arn,
      cloudAccount.external_id,
      query.startDate,
      query.endDate,
      query.granularity,
      metric
    );

    const normalizedData = normalizeAwsCostData(cloudAccountId, awsData, query.granularity, metric);
    await upsertCosts(normalizedData);
    
    // Fetch from database to serve normalized API
    const persistedCosts = await fetchCosts(cloudAccountId, query.startDate, query.endDate, query.granularity, metric);
    
    const response = buildBillingResponse(cloudAccountId, query, persistedCosts);

    await getPool().query(
      `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, 'BILLING_QUERY_COMPLETED', 'CLOUD_ACCOUNT', $3, $4, CURRENT_TIMESTAMP)`,
      [
        projectId,
        userId,
        cloudAccountId,
        JSON.stringify({ resultCount: persistedCosts.length })
      ]
    );

    logger.info('BILLING_QUERY_COMPLETED', { 
      projectId, cloudAccountId, resultCount: persistedCosts.length 
    });

    return response;
  } catch (error: any) {
    await getPool().query(
      `INSERT INTO audit_logs (project_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, 'BILLING_QUERY_FAILED', 'CLOUD_ACCOUNT', $3, $4, CURRENT_TIMESTAMP)`,
      [
        projectId,
        userId,
        cloudAccountId,
        JSON.stringify({ error: error.message })
      ]
    );

    logger.error('BILLING_QUERY_FAILED', { projectId, cloudAccountId, error });
    throw error;
  }
}

function buildBillingResponse(accountId: number, query: BillingQuery, costs: NormalizedCostRecord[]): BillingResponse {
  const currency = costs.length > 0 ? costs[0].currency : 'USD';
  
  // Aggregate totals
  let totalCost = 0;
  const serviceTotals: Record<string, number> = {};
  const dailyTotals: Record<string, number> = {};

  for (const record of costs) {
    const amt = parseFloat(record.amount) || 0;
    totalCost += amt;
    
    serviceTotals[record.serviceName] = (serviceTotals[record.serviceName] || 0) + amt;
    
    if (query.granularity === 'DAILY') {
      dailyTotals[record.periodStart] = (dailyTotals[record.periodStart] || 0) + amt;
    }
  }

  // Top services (top 3)
  const services = Object.entries(serviceTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([service, amount]) => ({
      service,
      amount: amount.toFixed(2)
    }));

  const daily = Object.entries(dailyTotals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({
      date,
      amount: amount.toFixed(2)
    }));

  let averageDailyCost = 0;
  let highestCostDay = null;
  if (query.granularity === 'DAILY' && daily.length > 0) {
    averageDailyCost = totalCost / daily.length;
    let maxAmt = -1;
    for (const d of daily) {
      const amt = parseFloat(d.amount);
      if (amt > maxAmt) {
        maxAmt = amt;
        highestCostDay = d;
      }
    }
  } else if (query.granularity === 'MONTHLY') {
    // If monthly, we could approximate daily cost by dividing by days, 
    // but without explicit days in month, we'll just say 0 for average daily cost if not daily.
  }

  const topServices = services.map(s => {
    const amt = parseFloat(s.amount);
    const percentage = totalCost > 0 ? (amt / totalCost) * 100 : 0;
    return {
      service: s.service,
      amount: s.amount,
      percentage: percentage.toFixed(2)
    };
  });

  const insights = {
    totalCost: totalCost.toFixed(2),
    averageDailyCost: averageDailyCost.toFixed(2),
    highestCostDay,
    topServices
  };

  return {
    accountId,
    currency,
    period: { start: query.startDate, end: query.endDate },
    granularity: query.granularity,
    totalCost: totalCost.toFixed(2),
    daily,
    services,
    insights
  };
}

function getDemoBillingResponse(accountId: number, query: BillingQuery): BillingResponse {
  // Return deterministic demo response
  return {
    accountId,
    currency: 'USD',
    period: { start: query.startDate, end: query.endDate },
    granularity: query.granularity,
    totalCost: '345.67',
    daily: query.granularity === 'DAILY' ? [
      { date: query.startDate, amount: '12.34' }
    ] : [],
    services: [
      { service: 'Amazon Elastic Compute Cloud - Compute (DEMO)', amount: '200.00' },
      { service: 'Amazon Relational Database Service (DEMO)', amount: '100.00' },
      { service: 'Amazon Simple Storage Service (DEMO)', amount: '45.67' }
    ],
    insights: {
      totalCost: '345.67',
      averageDailyCost: query.granularity === 'DAILY' ? '12.34' : '0.00',
      highestCostDay: query.granularity === 'DAILY' ? { date: query.startDate, amount: '12.34' } : null,
      topServices: [
        { service: 'Amazon Elastic Compute Cloud - Compute (DEMO)', amount: '200.00', percentage: '57.86' },
        { service: 'Amazon Relational Database Service (DEMO)', amount: '100.00', percentage: '28.93' },
        { service: 'Amazon Simple Storage Service (DEMO)', amount: '45.67', percentage: '13.21' }
      ]
    }
  };
}
