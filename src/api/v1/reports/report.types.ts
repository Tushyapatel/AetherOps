export interface ReportMetadata {
  projectId: number;
  projectName: string;
  generatedAt: string;
}

export interface ReportSummary {
  resourceCount: number;
  cloudAccountCount: number;
  overallRiskScore: number | null;
  severityDistribution: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    INFO: number;
  };
}

export interface ReportFinding {
  id: string;
  title: string;
  rule_code: string;
  category: string;
  severity: string;
  status: string;
  resource_name: string;
  resource_type: string;
  description: string;
  recommendation?: string;
  cloud_account_name: string;
}

export interface ReportResource {
  id: string;
  name: string;
  type: string;
  region: string;
  cloud_account_name: string;
}

export interface ReportAttackPath {
  id: string;
  title: string;
  description: string;
  severity: string;
  cloud_account_name: string;
}

export interface ReportCost {
  totalSpend: number;
  currency: string;
  /** Billing source: SIMULATED_DEMO for demo data, ACTUAL_AWS for real Cost Explorer data */
  billingSource: 'SIMULATED_DEMO' | 'ACTUAL_AWS' | 'MIXED';
  services: Array<{ serviceName: string; amount: number }>;
}

export interface ReportData {
  metadata: ReportMetadata;
  summary: ReportSummary;
  findings: ReportFinding[];
  resources: ReportResource[];
  attackPaths: ReportAttackPath[];
  costs: ReportCost | null;
  limitations: string[];
}
