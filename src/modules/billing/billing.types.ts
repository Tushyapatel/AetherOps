export type Granularity = 'DAILY' | 'MONTHLY';

export interface BillingQuery {
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string;   // YYYY-MM-DD (exclusive)
  granularity: Granularity;
}

export interface RawCostRecord {
  service: string;
  amount: string;
}

export interface NormalizedCostRecord {
  accountId: number;
  serviceName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  granularity: Granularity;
  metric: string;
  amount: string;
  currency: string;
}

export interface BillingResponse {
  accountId: number;
  currency: string;
  period: {
    start: string;
    end: string;
  };
  granularity: Granularity;
  totalCost: string;
  daily: { date: string; amount: string }[];
  services: { service: string; amount: string }[];
  insights: BillingSummary;
}

export interface BillingSummary {
  totalCost: string;
  averageDailyCost: string;
  highestCostDay: { date: string; amount: string } | null;
  topServices: { service: string; amount: string; percentage: string }[];
}
