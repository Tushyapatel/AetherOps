import { NormalizedPrice, NormalizedWorkload } from '../pricing.types';

export interface PricingProvider {
  /**
   * Identifies the provider for caching/logging purposes.
   */
  readonly providerName: string;

  /**
   * Retrieves normalized pricing for Compute (e.g. EC2/VM).
   */
  getComputePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null>;

  /**
   * Retrieves normalized pricing for Object Storage (e.g. S3/Blob).
   */
  getStoragePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null>;

  /**
   * Retrieves normalized pricing for Managed Relational Database (e.g. RDS/Cloud SQL).
   */
  getDatabasePrice(workload: NormalizedWorkload): Promise<NormalizedPrice | null>;
}
