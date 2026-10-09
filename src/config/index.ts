/**
 * AtherOps Backend – Application Configuration
 *
 * Centralised, validated configuration loaded once at startup.
 * All values are sourced from environment variables.
 * The application refuses to start if required variables are missing.
 */

import { z } from 'zod';

// ── Environment schema ────────────────────────────────────────────────────────

const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // API
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),

  // Database – all required in non-test environments
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // Connection pool
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),

  // Authentication – auth-specific rate limit for login/register
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000), // 15 min
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('atherops'),
  JWT_AUDIENCE: z.string().default('atherops-api'),

  // Cookie
  COOKIE_NAME: z.string().default('atherops_token'),

  // Cloud APIs
  GCP_API_KEY: z.string().optional(),
  ATHEROPS_SERVICE_PRINCIPAL_ARN: z.string().startsWith('arn:aws').optional(),

  // AI / Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY_1: z.string().optional(),
  GEMINI_API_KEY_2: z.string().optional(),
  GEMINI_API_KEY_3: z.string().optional(),
  GEMINI_API_KEY_4: z.string().optional(),
  GEMINI_KEY_COOLDOWN_SECONDS: z.coerce.number().int().min(1).default(900),
  AI_PROVIDER: z.enum(['gemini']).default('gemini'),
  AI_MODEL: z.string().default('gemini-2.0-flash'),
  AI_ENABLED: z.coerce.boolean().default(true),
  AI_MAX_CONTEXT_FINDINGS: z.coerce.number().int().min(1).default(20),
  AI_MAX_CONTEXT_RESOURCES: z.coerce.number().int().min(1).default(30),
  AI_MAX_CONTEXT_ATTACK_PATHS: z.coerce.number().int().min(1).default(10),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
});

// ── Parse and validate ────────────────────────────────────────────────────────

function loadConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    // Use plain console here — logger is not yet initialised
    console.error('[AtherOps] Fatal: invalid or missing environment variables:\n' + issues);
    console.error('[AtherOps] Copy .env.example to .env and fill in all required values.');
    process.exit(1);
  }

  return result.data;
}

const env = loadConfig();

// ── Derived config object ─────────────────────────────────────────────────────

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
  },

  api: {
    version: env.API_VERSION,
    prefix: env.API_PREFIX,
    /** Fully qualified prefix, e.g. /api/v1 */
    fullPrefix: `${env.API_PREFIX}/${env.API_VERSION}`,
  },

  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      idleTimeoutMs: env.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMs: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    },
  },

  cors: {
    /** Array of allowed origins parsed from the comma-separated env var */
    origins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },

  authRateLimit: {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  },

  cookie: {
    name: env.COOKIE_NAME,
  },

  cloudApis: {
    gcpApiKey: env.GCP_API_KEY,
    atheropsServicePrincipalArn: env.ATHEROPS_SERVICE_PRINCIPAL_ARN,
  },

  ai: {
    provider: env.AI_PROVIDER,
    model: env.AI_MODEL,
    enabled: env.AI_ENABLED,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiApiKey1: env.GEMINI_API_KEY_1,
    geminiApiKey2: env.GEMINI_API_KEY_2,
    geminiApiKey3: env.GEMINI_API_KEY_3,
    geminiApiKey4: env.GEMINI_API_KEY_4,
    geminiKeyCooldownSeconds: env.GEMINI_KEY_COOLDOWN_SECONDS,
    context: {
      maxFindings: env.AI_MAX_CONTEXT_FINDINGS,
      maxResources: env.AI_MAX_CONTEXT_RESOURCES,
      maxAttackPaths: env.AI_MAX_CONTEXT_ATTACK_PATHS,
    },
    timeoutMs: env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
  },
} as const;

export type Config = typeof config;
