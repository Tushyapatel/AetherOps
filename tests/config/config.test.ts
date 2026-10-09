/**
 * AtherOps – Test: Configuration Module
 *
 * Verifies that the config module:
 *  - parses environment variables correctly
 *  - applies correct defaults
 *  - derives computed values (e.g. fullPrefix)
 */

// Import config AFTER setting env vars in each test
describe('Configuration module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate env changes per test
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'atherops_test',
      DB_USER: 'test_user',
      DB_PASSWORD: 'test_pass',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads without throwing when all required vars are present', async () => {
    const { config } = await import('../../src/config');
    expect(config).toBeDefined();
  });

  it('computes the correct fullPrefix', async () => {
    const { config } = await import('../../src/config');
    expect(config.api.fullPrefix).toBe('/api/v1');
  });

  it('sets isTest flag correctly in test environment', async () => {
    const { config } = await import('../../src/config');
    expect(config.isTest).toBe(true);
    expect(config.isProduction).toBe(false);
  });

  it('applies default port 3001', async () => {
    const { config } = await import('../../src/config');
    expect(config.server.port).toBe(3001);
  });

  it('applies a custom PORT from environment', async () => {
    process.env['PORT'] = '4000';
    const { config } = await import('../../src/config');
    expect(config.server.port).toBe(4000);
  });

  it('parses CORS_ORIGINS into an array', async () => {
    process.env['CORS_ORIGINS'] = 'http://a.test,http://b.test';
    const { config } = await import('../../src/config');
    expect(config.cors.origins).toEqual(['http://a.test', 'http://b.test']);
  });
});
