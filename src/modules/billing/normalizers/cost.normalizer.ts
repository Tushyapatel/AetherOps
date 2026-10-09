import { ResultByTime } from '@aws-sdk/client-cost-explorer';
import { Granularity, NormalizedCostRecord } from '../billing.types';

export function normalizeAwsCostData(
  accountId: number,
  results: ResultByTime[],
  granularity: Granularity,
  metric: string
): NormalizedCostRecord[] {
  const normalized: NormalizedCostRecord[] = [];

  for (const period of results) {
    const start = period.TimePeriod?.Start;
    const end = period.TimePeriod?.End;
    if (!start || !end) continue;

    const groups = period.Groups || [];
    for (const group of groups) {
      const serviceName = group.Keys?.[0] || 'Unknown Service';
      const metricValue = group.Metrics?.[metric];

      if (metricValue && metricValue.Amount) {
        normalized.push({
          accountId,
          serviceName,
          periodStart: start,
          periodEnd: end,
          granularity,
          metric,
          amount: metricValue.Amount,
          currency: metricValue.Unit || 'USD',
        });
      }
    }
  }

  return normalized;
}
