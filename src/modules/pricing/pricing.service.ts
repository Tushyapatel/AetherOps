import { NormalizedWorkload, PricingComparisonRequest, PricingComparisonResponse, ProviderQuote, CalculationStatus, ComparisonStatus, Provider, CostType, DEFAULT_MONTHLY_HOURS } from './pricing.types';
import { AwsPricingClient } from './providers/aws/aws-pricing.client';
import { AzurePricingClient } from './providers/azure/azure-pricing.client';
import { GcpPricingClient } from './providers/gcp/gcp-pricing.client';
import { logger } from '../../logger';

import { getPool } from '../../database';

export function clearPricingCache(): void {
  // Demo implementation has no caching
}

export class PricingService {
  private awsClient = new AwsPricingClient();
  private azureClient = new AzurePricingClient();
  private gcpClient = new GcpPricingClient();

  async comparePricing(request: PricingComparisonRequest): Promise<PricingComparisonResponse> {
    const fullWorkload: NormalizedWorkload = {
      category: request.category,
      region: request.region,
      ...request.workload
    };

    const providers = [this.awsClient, this.azureClient, this.gcpClient];
    const quotes: ProviderQuote[] = [];

    let successfulCalculations = 0;

    for (const p of providers) {
      try {
        let priceData = null;
        
        if (request.category === 'COMPUTE') {
          priceData = await p.getComputePrice(fullWorkload);
        } else if (request.category === 'OBJECT_STORAGE') {
          priceData = await p.getStoragePrice(fullWorkload);
        } else if (request.category === 'RELATIONAL_DATABASE') {
          priceData = await p.getDatabasePrice(fullWorkload);
        }

        const costTypeMap: Record<Provider, CostType> = {
          AWS: 'ESTIMATED_AWS_PUBLIC_LIST',
          AZURE: 'ESTIMATED_AZURE_RETAIL',
          GCP: 'ESTIMATED_GCP_PUBLIC_LIST'
        };

        if (!priceData) {
          quotes.push({
            provider: p.providerName as Provider,
            costType: costTypeMap[p.providerName as Provider],
            status: 'UNKNOWN',
            currency: 'USD',
            source: 'DEMO_REFERENCE_PRICING',
            assumptions: [],
            missingInputs: ['Unable to map workload to SKU/region'],
            reason: 'NO_MATCHING_SKU'
          });
          continue;
        }

        const { cost, currency, source, assumptions, status, reason, unit, pricingModelVersion } = priceData;

        if (status === 'UNKNOWN' || status === 'NOT_COMPARABLE' || cost === undefined || isNaN(cost)) {
           quotes.push({
            provider: p.providerName as Provider,
            costType: costTypeMap[p.providerName as Provider],
            status: (status as CalculationStatus) || 'UNKNOWN',
            currency: currency || 'USD',
            source: source || 'DEMO_REFERENCE_PRICING',
            unit,
            pricingModelVersion,
            assumptions: assumptions || [],
            missingInputs: ['Failed to compute cost deterministically'],
            reason: reason || 'UNKNOWN_COST'
          });
        } else {
          quotes.push({
            provider: p.providerName as Provider,
            costType: costTypeMap[p.providerName as Provider],
            status: 'CALCULATED',
            cost: Number(cost.toFixed(2)),
            currency: currency || 'USD',
            source: source || 'DEMO_REFERENCE_PRICING',
            unit,
            pricingModelVersion,
            assumptions: assumptions || []
          });
          successfulCalculations++;
        }
      } catch (err: any) {
        logger.error(`Error calculating pricing for ${p.providerName}`, { error: err.message });
        const costTypeMap: Record<Provider, CostType> = {
          AWS: 'ESTIMATED_AWS_PUBLIC_LIST',
          AZURE: 'ESTIMATED_AZURE_RETAIL',
          GCP: 'ESTIMATED_GCP_PUBLIC_LIST'
        };
        quotes.push({
          provider: p.providerName as Provider,
          costType: costTypeMap[p.providerName as Provider],
          status: 'UNKNOWN',
          currency: 'USD',
          source: 'DEMO_REFERENCE_PRICING',
          assumptions: [],
          missingInputs: ['Error encountered during calculation'],
          reason: 'PROVIDER_ERROR'
        });
      }
    }

    let comparisonStatus: ComparisonStatus = 'COMPARABLE';
    if (successfulCalculations === 0) comparisonStatus = 'NOT_COMPARABLE';
    else if (successfulCalculations < providers.length) comparisonStatus = 'PARTIAL';

    return {
      comparisonStatus,
      period: {
        type: 'MONTHLY',
        assumption: `${fullWorkload.hoursPerMonth || DEFAULT_MONTHLY_HOURS} hours where applicable`
      },
      workload: fullWorkload,
      providers: quotes
    };
  }

  async compareCombinedPricing(request: import('./pricing.types').CombinedPricingComparisonRequest): Promise<import('./pricing.types').CombinedPricingComparisonResponse> {
    const components: any = {};
    const providers = ['AWS', 'AZURE', 'GCP'] as Provider[];
    const estimates: any = {
      AWS: { provider: 'AWS', costType: 'ESTIMATED_AWS_PUBLIC_LIST', cost: 0, status: 'CALCULATED', unit: 'USD_PER_MONTH' },
      AZURE: { provider: 'AZURE', costType: 'ESTIMATED_AZURE_RETAIL', cost: 0, status: 'CALCULATED', unit: 'USD_PER_MONTH' },
      GCP: { provider: 'GCP', costType: 'ESTIMATED_GCP_PUBLIC_LIST', cost: 0, status: 'CALCULATED', unit: 'USD_PER_MONTH' }
    };

    let hasAny = false;

    if (request.compute?.enabled) {
      hasAny = true;
      components.compute = await this.comparePricing({ category: 'COMPUTE', region: request.region, workload: request.compute.workload });
      for (const p of providers) {
        const q = components.compute.providers.find((x: any) => x.provider === p);
        if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
      }
    }
    
    if (request.database?.enabled) {
      hasAny = true;
      components.database = await this.comparePricing({ category: 'RELATIONAL_DATABASE', region: request.region, workload: request.database.workload });
      for (const p of providers) {
        const q = components.database.providers.find((x: any) => x.provider === p);
        if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
      }
    }

    if (request.storage?.enabled) {
      hasAny = true;
      components.storage = await this.comparePricing({ category: 'OBJECT_STORAGE', region: request.region, workload: request.storage.workload });
      for (const p of providers) {
        const q = components.storage.providers.find((x: any) => x.provider === p);
        if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
      }
    }

    if (!hasAny) {
      return {
        comparisonStatus: 'NOT_COMPARABLE',
        components: {},
        providers: providers.map(p => ({
          provider: p,
          costType: estimates[p].costType,
          status: 'NOT_COMPARABLE',
          currency: 'USD',
          source: 'DEMO_REFERENCE_PRICING',
          assumptions: []
        }))
      };
    }

    return {
      comparisonStatus: 'COMPARABLE', // Simplification
      components,
      providers: Object.values(estimates).map((e: any) => ({
        ...e,
        cost: Number(e.cost.toFixed(2)),
        currency: 'USD',
        source: 'DEMO_REFERENCE_PRICING',
        assumptions: []
      }))
    };
  }

  private mapInstanceType(type: string) {
    if (type.includes('small')) return { cpu: 2, memoryGb: 2 };
    if (type.includes('medium')) return { cpu: 2, memoryGb: 4 };
    if (type.includes('large') && !type.includes('xlarge')) return { cpu: 2, memoryGb: 8 };
    if (type.includes('2xlarge')) return { cpu: 8, memoryGb: 32 };
    if (type.includes('4xlarge')) return { cpu: 16, memoryGb: 64 };
    if (type.includes('8xlarge')) return { cpu: 32, memoryGb: 128 };
    return { cpu: 2, memoryGb: 4 };
  }

  async compareCurrentAccount(projectId: string, accountId: number): Promise<any> {
    const pool = getPool();

    const accRes = await pool.query('SELECT * FROM cloud_accounts WHERE id = $1 AND project_id = $2', [accountId, projectId]);
    if (accRes.rows.length === 0) {
      throw new Error('Account not found or access denied');
    }
    const account = accRes.rows[0];

    const resRes = await pool.query('SELECT resource_type, region, attributes FROM resources WHERE account_id = $1', [accountId]);
    let region = 'INDIA';
    let totalCpu = 0, totalMem = 0, totalDbCpu = 0, totalDbMem = 0, totalStorageGb = 0;
    let hasCompute = false, hasDb = false, hasStorage = false;
    let ec2Count = 0, rdsCount = 0, s3Count = 0;

    for (const r of resRes.rows) {
      if (r.region && r.region.toUpperCase() !== 'UNKNOWN') {
        region = r.region.toUpperCase() === 'AP-SOUTH-1' ? 'INDIA' : 'US_EAST';
      }
      if (r.resource_type === 'EC2') {
        hasCompute = true; ec2Count++;
        const mapped = this.mapInstanceType(r.attributes?.instance_type || '');
        totalCpu += mapped.cpu; totalMem += mapped.memoryGb;
      }
      if (r.resource_type === 'RDS') {
        hasDb = true; rdsCount++;
        const mapped = this.mapInstanceType(r.attributes?.instance_class || '');
        totalDbCpu += mapped.cpu; totalDbMem += mapped.memoryGb;
      }
      if (r.resource_type === 'S3') {
        hasStorage = true; s3Count++;
        totalStorageGb += (r.attributes?.storage_gb || 100);
      }
    }

    const providers = ['AWS', 'AZURE', 'GCP'] as Provider[];
    const estimates = {
      AWS: { provider: 'AWS', costType: 'ESTIMATED_AWS_PUBLIC_LIST', cost: 0, status: 'CALCULATED' },
      AZURE: { provider: 'AZURE', costType: 'ESTIMATED_AZURE_RETAIL', cost: 0, status: 'CALCULATED' },
      GCP: { provider: 'GCP', costType: 'ESTIMATED_GCP_PUBLIC_LIST', cost: 0, status: 'CALCULATED' }
    };

    let comparisonStatus = 'COMPARABLE';

    if (!hasCompute && !hasDb && !hasStorage) {
      comparisonStatus = 'NOT_COMPARABLE';
      for (const p of providers) estimates[p].status = 'UNKNOWN';
    } else {
      if (hasCompute) {
        const res = await this.comparePricing({ category: 'COMPUTE', region, workload: { cpu: totalCpu, memoryGb: totalMem } });
        for (const p of providers) {
          const q = res.providers.find(x => x.provider === p);
          if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
        }
      }
      if (hasDb) {
        const res = await this.comparePricing({ category: 'RELATIONAL_DATABASE', region, workload: { cpu: totalDbCpu, memoryGb: totalDbMem } });
        for (const p of providers) {
          const q = res.providers.find(x => x.provider === p);
          if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
        }
      }
      if (hasStorage) {
        const res = await this.comparePricing({ category: 'OBJECT_STORAGE', region, workload: { storageGb: totalStorageGb } });
        for (const p of providers) {
          const q = res.providers.find(x => x.provider === p);
          if (q && q.status === 'CALCULATED') estimates[p].cost += (q.cost || 0); else estimates[p].status = 'UNKNOWN';
        }
      }
    }

    const costsRes = await pool.query('SELECT SUM(amount) as total, MAX(metric) as metric FROM costs WHERE account_id = $1', [accountId]);
    const currentCost = parseFloat(costsRes.rows[0].total || '0');
    const metric = costsRes.rows[0].metric || 'SIMULATED_BILLING';
    const billingType = metric === 'SIMULATED_BILLING' ? 'SIMULATED DEMO BILLING' : 'ACTUAL AWS BILLING';

    return {
      comparisonStatus,
      accountInfo: {
        accountName: account.account_name,
        awsAccountId: account.aws_account_id,
        environment: account.environment,
        region
      },
      workloadSummary: {
        ec2Count, totalCpu, totalMem,
        rdsCount, totalDbCpu, totalDbMem,
        s3Count, totalStorageGb
      },
      billing: {
        currentCost,
        billingType
      },
      providers: Object.values(estimates).map(e => ({
        ...e,
        cost: Number(e.cost.toFixed(2))
      }))
    };
  }
}
