import { PricingProvider } from '../pricing.provider.interface';
import { NormalizedPrice, NormalizedWorkload, DEFAULT_MONTHLY_HOURS } from '../../pricing.types';
import { DemoCatalog } from '../demo-catalog';

export class AwsPricingClient implements PricingProvider {
  readonly providerName = 'AWS';

  private mapRegion(region: string): string | null {
    if (region === 'INDIA') return 'ap-south-1';
    if (region === 'US_EAST') return 'us-east-1';
    return null;
  }

  private normalizeUnit(unit: string): string {
    if (unit.toLowerCase().includes('hour')) return 'USD_PER_HOUR';
    if (unit.toLowerCase().includes('gb-mo') || unit.toLowerCase().includes('gb/mo')) return 'USD_PER_GB_MONTH';
    return 'USD_PER_UNIT';
  }

  private calculateCost(rate: number, unit: string, workload: NormalizedWorkload): number {
    const hours = workload.hoursPerMonth || DEFAULT_MONTHLY_HOURS;
    const isComputeOrDb = workload.category === 'COMPUTE' || workload.category === 'RELATIONAL_DATABASE';
    const scale = isComputeOrDb ? ((workload.cpu || 1) + (workload.memoryGb || 2) / 2) / 2 : 1;

    if (unit.toLowerCase().includes('hour')) return rate * hours * scale;
    if (unit.toLowerCase().includes('gb-mo') || unit.toLowerCase().includes('gb/mo')) return rate * (workload.storageGb || 1);
    return rate * hours * scale; 
  }

  private createPrice(category: keyof typeof DemoCatalog['AWS'], workload: NormalizedWorkload): NormalizedPrice {
    const mappedRegion = this.mapRegion(workload.region);
    
    if (!mappedRegion) {
      return {
        provider: 'AWS',
        service: category,
        sku: 'UNKNOWN',
        productName: 'UNKNOWN',
        region: workload.region,
        unit: 'UNKNOWN',
        rate: 0,
        currency: 'USD',
        pricingModel: 'ON_DEMAND',
        source: 'DEMO_REFERENCE_PRICING',
        pricingModelVersion: '2026.1',
        assumptions: [],
        status: 'NOT_COMPARABLE',
        reason: 'UNSUPPORTED_REGION'
      };
    }

    const catalogEntry = (DemoCatalog.AWS[category] as any)[mappedRegion] || (DemoCatalog.AWS[category] as any)['default'];
    
    const hours = workload.hoursPerMonth || DEFAULT_MONTHLY_HOURS;
    const os = workload.operatingSystem || 'Linux';

    return {
      provider: 'AWS',
      service: category === 'COMPUTE' ? 'Amazon EC2' : category === 'OBJECT_STORAGE' ? 'Amazon S3' : 'Amazon RDS',
      sku: catalogEntry.sku,
      productName: catalogEntry.productName,
      region: mappedRegion,
      unit: this.normalizeUnit(catalogEntry.unit),
      rate: catalogEntry.rate,
      cost: this.calculateCost(catalogEntry.rate, catalogEntry.unit, workload),
      currency: 'USD',
      pricingModel: 'ON_DEMAND',
      source: 'DEMO_REFERENCE_PRICING',
      pricingModelVersion: '2026.1',
      assumptions: [
        `Region: ${workload.region}`,
        `OS: ${os}`,
        `Monthly hours: ${hours}`,
        `Model: On-Demand`,
        `Used demo reference pricing for AWS list prices`
      ],
      status: 'CALCULATED'
    };
  }

  async getComputePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null> {
    return this.createPrice('COMPUTE', workload);
  }

  async getStoragePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null> {
    return this.createPrice('OBJECT_STORAGE', workload);
  }

  async getDatabasePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null> {
    return this.createPrice('RELATIONAL_DATABASE', workload);
  }
}
