import { persistFindings } from '../../../src/modules/security/rules/rule.repository';

// Mock DB
const mockQuery = jest.fn();
jest.mock('../../../src/database', () => ({
  getPool: () => ({
    query: mockQuery
  })
}));

describe('Finding Lifecycle & Idempotency', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  it('inserts new findings if they do not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // existingResult
    mockQuery.mockResolvedValueOnce({}); // insert finding
    mockQuery.mockResolvedValueOnce({}); // update analysis_runs

    const results = [
      { ruleCode: 'SG-001', resourceId: 10, severity: 'HIGH' as const, status: 'OPEN' as const, note: 'note' }
    ];

    const stats = await persistFindings(1, 100, results);
    expect(stats.findingsCreated).toBe(1);
    expect(stats.findingsUpdated).toBe(0);
    
    // 1st query: Select existing
    // 2nd query: Insert
    // 3rd query: Update analysis_runs
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO findings');
  });

  it('updates existing findings if they exist', async () => {
    // Already an OPEN finding in DB
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 99, resource_id: 10, rule_id: 'SG-001', status: 'OPEN' }
      ]
    });
    mockQuery.mockResolvedValueOnce({}); // update finding
    mockQuery.mockResolvedValueOnce({}); // update analysis_runs

    const results = [
      { ruleCode: 'SG-001', resourceId: 10, severity: 'HIGH' as const, status: 'OPEN' as const, note: 'note updated' }
    ];

    const stats = await persistFindings(1, 100, results);
    
    // findingsCreated should be 0 because it was already OPEN
    expect(stats.findingsCreated).toBe(0); 
    expect(stats.findingsUpdated).toBe(1);

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[1][0]).toContain('UPDATE findings');
    expect(mockQuery.mock.calls[1][1]).toContain(99); // id
  });

  it('resolves OPEN finding if it is no longer insecure', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 99, resource_id: 10, rule_id: 'SG-001', status: 'OPEN' }
      ]
    });
    mockQuery.mockResolvedValueOnce({}); // update finding (RESOLVED)
    mockQuery.mockResolvedValueOnce({}); // update analysis_runs

    // Note: results is empty because the resource is secure now!
    const results: any[] = [];

    const stats = await persistFindings(1, 100, results);
    expect(stats.findingsCreated).toBe(0);
    expect(stats.findingsResolved).toBe(1);

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[1][0]).toContain("status = 'RESOLVED'");
    expect(mockQuery.mock.calls[1][1]).toContain(99); // id
  });
  
  it('does not touch previously resolved finding if it remains secure', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 99, resource_id: 10, rule_id: 'SG-001', status: 'RESOLVED' }
      ]
    });
    mockQuery.mockResolvedValueOnce({}); // update analysis_runs

    const stats = await persistFindings(1, 100, []);
    expect(stats.findingsCreated).toBe(0);
    expect(stats.findingsResolved).toBe(0);
    // 1 query to get existing, 1 query to update analysis_runs
    expect(mockQuery).toHaveBeenCalledTimes(2); 
  });
});
