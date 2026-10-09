import { GeminiProvider } from '../../src/modules/ai/providers/gemini/gemini.provider';
import { AIError } from '../../src/modules/ai/ai.types';
import { logger } from '../../src/logger';

// Mock logger to avoid noise
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('GeminiProvider Failover and Key Manager', () => {
  let provider: GeminiProvider;
  
  const dummyInput = {
    operation: 'SECURITY_ANALYSIS' as any,
    userPrompt: 'Test',
    systemInstruction: 'Test'
  };

  const createMockResult = () => ({
    summary: 'Mock',
    keyInsights: [],
    recommendedActions: [],
    limitations: []
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. KEY_1 success -> only KEY_1 used', async () => {
    provider = new GeminiProvider(['key1', 'key2', 'key3', 'key4'], 'gemini-2.0-flash');
    const mockCall = jest.fn().mockResolvedValue(createMockResult());
    (provider as any).callGemini = mockCall;

    await provider.generateAnalysis(dummyInput);
    
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
  });

  it('2. KEY_1 429 -> KEY_1 marked unavailable -> KEY_2 attempted', async () => {
    provider = new GeminiProvider(['key1', 'key2', 'key3', 'key4'], 'gemini-2.0-flash');
    const mockCall = jest.fn()
      .mockRejectedValueOnce(new Error('Google generative AI error: RATE_LIMIT_EXCEEDED'))
      .mockResolvedValueOnce(createMockResult());
    (provider as any).callGemini = mockCall;

    await provider.generateAnalysis(dummyInput);
    
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
    expect(mockCall.mock.calls[1][1].id).toBe('KEY_2');
  });

  it('3. KEY_1 401/403 -> KEY_1 marked unavailable -> KEY_2 attempted', async () => {
    provider = new GeminiProvider(['key1', 'key2'], 'gemini-2.0-flash');
    const mockCall = jest.fn()
      .mockRejectedValueOnce(new Error('API_KEY invalid'))
      .mockResolvedValueOnce(createMockResult());
    (provider as any).callGemini = mockCall;

    await provider.generateAnalysis(dummyInput);
    
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
    expect(mockCall.mock.calls[1][1].id).toBe('KEY_2');
  });

  it('4. KEY_1 429, KEY_2 429, KEY_3 success -> KEY_3 succeeds', async () => {
    provider = new GeminiProvider(['key1', 'key2', 'key3', 'key4'], 'gemini-2.0-flash');
    const mockCall = jest.fn()
      .mockRejectedValueOnce(new Error('RATE_LIMIT_EXCEEDED'))
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
      .mockResolvedValueOnce(createMockResult());
    (provider as any).callGemini = mockCall;

    await provider.generateAnalysis(dummyInput);
    
    expect(mockCall).toHaveBeenCalledTimes(3);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
    expect(mockCall.mock.calls[1][1].id).toBe('KEY_2');
    expect(mockCall.mock.calls[2][1].id).toBe('KEY_3');
  });

  it('5. All four unavailable -> safe provider-unavailable response', async () => {
    provider = new GeminiProvider(['key1', 'key2', 'key3', 'key4'], 'gemini-2.0-flash');
    const mockCall = jest.fn().mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
    (provider as any).callGemini = mockCall;

    await expect(provider.generateAnalysis(dummyInput)).rejects.toThrow(AIError);
    await expect(provider.generateAnalysis(dummyInput)).rejects.toHaveProperty('code', 'PROVIDER_UNAVAILABLE');
    
    expect(mockCall).toHaveBeenCalledTimes(4);
  });

  it('6. Cooldown expires -> previously unavailable key becomes eligible again', async () => {
    // Cooldown 1 second
    provider = new GeminiProvider(['key1', 'key2'], 'gemini-2.0-flash', 30000, 2, 1);
    
    const mockCall = jest.fn()
      .mockRejectedValueOnce(new Error('429 RATE_LIMIT_EXCEEDED')) // key 1 fails
      .mockResolvedValueOnce(createMockResult()) // key 2 succeeds
      .mockResolvedValueOnce(createMockResult()); // key 1 succeeds after cooldown

    (provider as any).callGemini = mockCall;

    await provider.generateAnalysis(dummyInput);
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
    expect(mockCall.mock.calls[1][1].id).toBe('KEY_2');

    // Wait 1.1s for cooldown to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    await provider.generateAnalysis(dummyInput);
    expect(mockCall).toHaveBeenCalledTimes(3);
    expect(mockCall.mock.calls[2][1].id).toBe('KEY_1');
  });

  it('7. Non-failover application error -> do NOT unnecessarily consume all keys', async () => {
    provider = new GeminiProvider(['key1', 'key2', 'key3', 'key4'], 'gemini-2.0-flash');
    // Simulate a schema error (non-retryable)
    const mockCall = jest.fn().mockRejectedValue(new AIError('SCHEMA_VALIDATION_FAILED', 'Invalid JSON', false));
    (provider as any).callGemini = mockCall;

    await expect(provider.generateAnalysis(dummyInput)).rejects.toHaveProperty('code', 'SCHEMA_VALIDATION_FAILED');
    
    // Should only be called once, no failover!
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall.mock.calls[0][1].id).toBe('KEY_1');
  });

  it('8. Maximum attempts -> never exceed configured key count', async () => {
    provider = new GeminiProvider(['key1', 'key2'], 'gemini-2.0-flash');
    const mockCall = jest.fn().mockRejectedValue(new Error('429 limit'));
    (provider as any).callGemini = mockCall;

    await expect(provider.generateAnalysis(dummyInput)).rejects.toThrow();
    
    // Only 2 keys configured, should only try 2 times max per request
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
