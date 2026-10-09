import { fetchAwsBillingData } from '../../../src/modules/billing/aws/cost-explorer.client';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { getTemporaryCredentials } from '../../../src/infrastructure/aws/aws.sts';

jest.mock('@aws-sdk/client-cost-explorer');
jest.mock('../../../src/infrastructure/aws/aws.sts');
jest.mock('../../../src/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

const mockGetTempCreds = getTemporaryCredentials as jest.MockedFunction<typeof getTemporaryCredentials>;
const mockClientSend = jest.fn();

describe('cost-explorer.client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTempCreds.mockResolvedValue({
      accessKeyId: 'AKIA',
      secretAccessKey: 'SECRET',
      sessionToken: 'TOKEN'
    });
    
    (CostExplorerClient as jest.Mock).mockImplementation(() => ({
      send: mockClientSend,
      destroy: jest.fn()
    }));
  });

  it('should handle pagination correctly', async () => {
    // Page 1
    mockClientSend.mockResolvedValueOnce({
      NextPageToken: 'token-page-2',
      ResultsByTime: [{ TimePeriod: { Start: '2023-10-01', End: '2023-10-02' } }]
    });
    // Page 2
    mockClientSend.mockResolvedValueOnce({
      NextPageToken: undefined,
      ResultsByTime: [{ TimePeriod: { Start: '2023-10-02', End: '2023-10-03' } }]
    });

    const results = await fetchAwsBillingData('arn:role', 'ext-123', '2023-10-01', '2023-10-03', 'DAILY');
    expect(results.length).toBe(2);
    expect(mockClientSend).toHaveBeenCalledTimes(2);
  });

  it('should retry on throttling', async () => {
    const throttleError = new Error('Throttling');
    throttleError.name = 'ThrottlingException';
    
    mockClientSend
      .mockRejectedValueOnce(throttleError)
      .mockResolvedValueOnce({
        ResultsByTime: [{ TimePeriod: { Start: '2023-10-01', End: '2023-10-02' } }]
      });

    const results = await fetchAwsBillingData('arn:role', 'ext-123', '2023-10-01', '2023-10-02', 'DAILY');
    expect(results.length).toBe(1);
    expect(mockClientSend).toHaveBeenCalledTimes(2);
  });
});
