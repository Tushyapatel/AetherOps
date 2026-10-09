import { getPool } from '../../database';
import { NormalizedCostRecord } from './billing.types';
import { logger } from '../../logger';



export async function upsertCosts(records: NormalizedCostRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Note: To optimize large inserts we can do batched inserts, but for now simple param arrays.
    // The query can be built dynamically or we can loop, since cost rows per month are relatively small.
    // Given PG limits, we'll do an unnest approach or batched standard inserts.
    
    const accountIds: number[] = [];
    const serviceNames: string[] = [];
    const periodStarts: string[] = [];
    const periodEnds: string[] = [];
    const granularities: string[] = [];
    const metrics: string[] = [];
    const amounts: string[] = [];
    const currencies: string[] = [];

    for (const r of records) {
      accountIds.push(r.accountId);
      serviceNames.push(r.serviceName);
      periodStarts.push(r.periodStart);
      periodEnds.push(r.periodEnd);
      granularities.push(r.granularity);
      metrics.push(r.metric);
      amounts.push(r.amount);
      currencies.push(r.currency);
    }

    const query = `
      INSERT INTO costs (
        account_id, service_name, period_start, period_end, granularity, metric, amount, currency
      )
      SELECT * FROM UNNEST (
        $1::int[], $2::varchar[], $3::date[], $4::date[], $5::varchar[], $6::varchar[], $7::numeric[], $8::varchar[]
      )
      ON CONFLICT (account_id, service_name, period_start, period_end, granularity, metric)
      DO UPDATE SET
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency
    `;

    const res = await client.query(query, [
      accountIds, serviceNames, periodStarts, periodEnds, granularities, metrics, amounts, currencies
    ]);

    await client.query('COMMIT');
    return res.rowCount || 0;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to upsert costs', { error: err });
    throw err;
  } finally {
    client.release();
  }
}

export async function fetchCosts(
  accountId: number,
  startDate: string,
  endDate: string,
  granularity: string,
  metric: string
): Promise<NormalizedCostRecord[]> {
  const pool = getPool();
  const query = `
    SELECT 
      account_id as "accountId",
      service_name as "serviceName",
      TO_CHAR(period_start, 'YYYY-MM-DD') as "periodStart",
      TO_CHAR(period_end, 'YYYY-MM-DD') as "periodEnd",
      granularity,
      metric,
      amount::text,
      currency
    FROM costs
    WHERE account_id = $1
      AND granularity = $2
      AND metric = $3
      AND period_start >= $4::date
      AND period_end <= $5::date
    ORDER BY period_start ASC, service_name ASC
  `;
  const result = await pool.query(query, [accountId, granularity, metric, startDate, endDate]);
  return result.rows;
}
