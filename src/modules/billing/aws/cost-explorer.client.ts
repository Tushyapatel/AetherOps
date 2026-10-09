import { CostExplorerClient, GetCostAndUsageCommand, ResultByTime } from '@aws-sdk/client-cost-explorer';
import { getTemporaryCredentials } from '../../../infrastructure/aws/aws.sts';
import { logger } from '../../../logger';

export async function fetchAwsBillingData(
  roleArn: string,
  externalId: string,
  startDate: string,
  endDate: string,
  granularity: 'DAILY' | 'MONTHLY',
  metric: string = 'UnblendedCost'
): Promise<ResultByTime[]> {
  let credentials;
  try {
    credentials = await getTemporaryCredentials(roleArn, externalId);
  } catch (error) {
    logger.error('Failed to assume role for billing', { roleArn, error });
    throw error;
  }

  // Cost Explorer endpoint is globally us-east-1
  const client = new CostExplorerClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  const results: ResultByTime[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const command: GetCostAndUsageCommand = new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: granularity,
        Metrics: [metric],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        NextPageToken: nextPageToken,
      });

      let retries = 0;
      const MAX_RETRIES = 3;
      let success = false;
      let response: any;

      while (!success && retries <= MAX_RETRIES) {
        try {
          response = await client.send(command);
          success = true;
        } catch (error: any) {
          if (
            (error.name === 'ThrottlingException' || error.$metadata?.httpStatusCode === 429) &&
            retries < MAX_RETRIES
          ) {
            const delay = Math.pow(2, retries) * 1000;
            logger.warn('AWS Cost Explorer throttled, retrying...', { retries, delay, roleArn });
            await new Promise((resolve) => setTimeout(resolve, delay));
            retries++;
          } else {
            throw error;
          }
        }
      }

      if (response && response.ResultsByTime) {
        results.push(...response.ResultsByTime);
      }
      nextPageToken = response?.NextPageToken;
    } while (nextPageToken);
  } catch (error: any) {
    logger.error('AWS Cost Explorer query failed', { roleArn, startDate, endDate, error: error.message });
    throw error;
  } finally {
    client.destroy();
  }

  return results;
}
