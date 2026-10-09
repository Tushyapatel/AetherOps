export type Provider = 'AWS' | 'AZURE' | 'GCP';

export type WorkloadCategory = 'COMPUTE' | 'OBJECT_STORAGE' | 'RELATIONAL_DATABASE' | 'NETWORKING' | 'UNKNOWN';

export const DEFAULT_MONTHLY_HOURS = 730;

export type PricingModel = 'ON_DEMAND'; 

export type CostType = 
  | 'ACTUAL_AWS_BILLING' 
  | 'ESTIMATED_AWS_PUBLIC_LIST' 
  | 'ESTIMATED_AZURE_RETAIL' 
  | 'ESTIMATED_GCP_PUBLIC_LIST' 
  | 'SIMULATED_DEMO_BILLING' 
  | 'DEMO_REFERENCE_PRICING';

export type CalculationStatus = 'CALCULATED' | 'UNKNOWN' | 'NOT_COMPARABLE';

export type ComparisonStatus = 'COMPARABLE' | 'PARTIAL' | 'NOT_COMPARABLE';

export interface NormalizedWorkload {
  service?: string;
  category: WorkloadCategory;
  region: string;
  cpu?: number;
  memoryGb?: number;
  storageGb?: number;
  hoursPerMonth?: number; 
  operatingSystem?: string;
  storageType?: string;
  iops?: number;
  throughput?: number;
  requestCount?: number;
  dataTransfer?: number;
  networkPath?: string;
  pricingModel?: string;
}

export interface NormalizedPrice {
  provider: Provider;
  service: string;
  resourceType?: string;
  sku: string;
  productName: string;
  region: string;
  usageType?: string;
  unit: string;
  quantity?: number;
  rate: number;
  cost?: number;
  currency: string;
  pricingModel: string;
  source: string;
  effectiveTime?: string;
  fetchedAt?: string;
  pricingModelVersion?: string;
  assumptions: string[];
  confidence?: string;
  status?: string;
  reason?: string;
}

export interface ProviderQuote {
  provider: Provider;
  costType: CostType;
  status: CalculationStatus;
  cost?: number;
  currency: string;
  source: string;
  unit?: string;
  pricingModelVersion?: string;
  assumptions: string[];
  missingInputs?: string[];
  reason?: string;
}

export interface PricingComparisonRequest {
  category: WorkloadCategory;
  region: string;
  workload: Omit<NormalizedWorkload, 'category' | 'region'>;
}

export interface ComponentRequest {
  enabled: boolean;
  workload: Omit<NormalizedWorkload, 'category' | 'region'>;
}

export interface CombinedPricingComparisonRequest {
  region: string;
  compute?: ComponentRequest;
  storage?: ComponentRequest;
  database?: ComponentRequest;
}

export interface PricingComparisonResponse {
  comparisonStatus: ComparisonStatus;
  period: {
    type: string;
    assumption: string;
  };
  workload: NormalizedWorkload;
  providers: ProviderQuote[];
}

export interface CombinedPricingComparisonResponse {
  comparisonStatus: ComparisonStatus;
  components: {
    compute?: PricingComparisonResponse;
    storage?: PricingComparisonResponse;
    database?: PricingComparisonResponse;
  };
  providers: ProviderQuote[];
}
