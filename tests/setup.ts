/**
 * AtherOps – Jest Setup File
 *
 * Runs before each test file.
 * Sets the minimum required environment variables so the config
 * module does not call process.exit(1) during test bootstrapping.
 */

process.env['NODE_ENV'] = 'test';
process.env['DB_HOST'] = process.env['DB_HOST'] ?? 'localhost';
process.env['DB_PORT'] = process.env['DB_PORT'] ?? '5432';
process.env['DB_NAME'] = process.env['DB_NAME'] ?? 'atherops_test';
process.env['DB_USER'] = process.env['DB_USER'] ?? 'test_user';
process.env['DB_PASSWORD'] = process.env['DB_PASSWORD'] ?? 'test_pass';
process.env['LOG_LEVEL'] = 'error'; // Suppress logs during tests
// Minimum 32-char secret required by config validation
process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] ?? 'test-jwt-secret-at-least-32-characters-long!!';
process.env['GCP_API_KEY'] = process.env['GCP_API_KEY'] ?? 'test-gcp-key';
