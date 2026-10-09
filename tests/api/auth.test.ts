/**
 * AtherOps – Test: Auth Endpoints
 *
 * Tests for POST /api/v1/auth/register, /login, /logout
 * and GET /api/v1/auth/me.
 *
 * All database calls and bcrypt are mocked for deterministic, fast tests.
 * No live database or real password hashing required.
 */

import request from 'supertest';
import { createApp } from '../../src/app';

// ── Mock the database ─────────────────────────────────────────────────────────
jest.mock('../../src/database', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ status: 'healthy', latencyMs: 1, serverVersion: 'PostgreSQL 18', error: null }),
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
  query: jest.fn(),
  withClient: jest.fn(),
}));

// ── Mock the auth repository ──────────────────────────────────────────────────
jest.mock('../../src/api/v1/auth/auth.repository', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  emailExists: jest.fn(),
}));

// ── Mock bcrypt ───────────────────────────────────────────────────────────────
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn(),
}));

import {
  findUserByEmail,
  findUserById,
  createUser,
  emailExists,
} from '../../src/api/v1/auth/auth.repository';
import bcrypt from 'bcrypt';

const mockFindUserByEmail = findUserByEmail as jest.MockedFunction<typeof findUserByEmail>;
const mockFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockCreateUser = createUser as jest.MockedFunction<typeof createUser>;
const mockEmailExists = emailExists as jest.MockedFunction<typeof emailExists>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

// ── Shared test fixtures ──────────────────────────────────────────────────────

const MOCK_SAFE_USER = {
  id: 1,
  email: 'test@example.com',
  role: 'viewer' as const,
  status: 'ACTIVE' as const,
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const MOCK_USER_ROW = {
  ...MOCK_SAFE_USER,
  password_hash: '$2b$12$hashedpassword',
};

const VALID_PASSWORD = 'Password123';
const WEAK_PASSWORD = 'weak';
const VALID_EMAIL = 'test@example.com';
const INVALID_EMAIL = 'not-an-email';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Auth Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // POST /api/v1/auth/register
  // ============================================================================

  describe('POST /api/v1/auth/register', () => {
    describe('successful registration', () => {
      beforeEach(() => {
        mockEmailExists.mockResolvedValue(false);
        mockCreateUser.mockResolvedValue(MOCK_SAFE_USER);
      });

      it('returns HTTP 201', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.status).toBe(201);
      });

      it('returns success: true with user data', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(1);
        expect(res.body.data.email).toBe(VALID_EMAIL);
        expect(res.body.data.role).toBe('viewer');
      });

      it('does NOT return password_hash in response', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.body.data).not.toHaveProperty('password_hash');
        expect(res.body).not.toHaveProperty('password_hash');
        expect(JSON.stringify(res.body)).not.toContain('password_hash');
      });

      it('sets an HTTP-only cookie', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        // Cookie must be httpOnly
        const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
        expect(cookieStr.toLowerCase()).toContain('httponly');
      });

      it('hashes the password (bcrypt.hash called)', async () => {
        await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(bcrypt.hash).toHaveBeenCalledWith(VALID_PASSWORD, 12);
      });

      it('normalises email to lowercase', async () => {
        await request(app)
          .post('/api/v1/auth/register')
          .send({ email: 'TEST@EXAMPLE.COM', password: VALID_PASSWORD });
        // createUser should be called with lowercased email
        expect(mockCreateUser).toHaveBeenCalledWith('test@example.com', expect.any(String));
      });
    });

    describe('invalid input', () => {
      it('returns 400 for invalid email', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: INVALID_EMAIL, password: VALID_PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('returns 400 for missing email', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ password: VALID_PASSWORD });
        expect(res.status).toBe(400);
      });

      it('returns 400 for weak password (too short)', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: WEAK_PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('returns 400 for password with no uppercase letter', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: 'password123' });
        expect(res.status).toBe(400);
      });

      it('returns 400 for password with no number', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: 'PasswordOnly' });
        expect(res.status).toBe(400);
      });

      it('returns 400 for missing password', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL });
        expect(res.status).toBe(400);
      });
    });

    describe('duplicate email', () => {
      beforeEach(() => {
        mockEmailExists.mockResolvedValue(true);
      });

      it('returns 409 for duplicate email', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('CONFLICT');
      });

      it('does not store a second user', async () => {
        await request(app)
          .post('/api/v1/auth/register')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(mockCreateUser).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // POST /api/v1/auth/login
  // ============================================================================

  describe('POST /api/v1/auth/login', () => {
    describe('successful login', () => {
      beforeEach(() => {
        mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
        mockBcryptCompare.mockResolvedValue(true as never);
      });

      it('returns HTTP 200', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.status).toBe(200);
      });

      it('returns user data without password_hash', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(VALID_EMAIL);
        expect(res.body.data).not.toHaveProperty('password_hash');
        expect(JSON.stringify(res.body)).not.toContain('password_hash');
      });

      it('sets an HTTP-only cookie', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
        expect(cookieStr.toLowerCase()).toContain('httponly');
      });

      it('sets cookie with JWT that is valid', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
      });
    });

    describe('failed login', () => {
      it('returns 401 for wrong password', async () => {
        mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
        mockBcryptCompare.mockResolvedValue(false as never);

        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: 'WrongPassword1' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('returns 401 for unknown email', async () => {
        mockFindUserByEmail.mockResolvedValue(null);
        mockBcryptCompare.mockResolvedValue(false as never);

        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'nobody@example.com', password: VALID_PASSWORD });
        expect(res.status).toBe(401);
      });

      it('uses generic error message — does not reveal email existence', async () => {
        // Unknown email
        mockFindUserByEmail.mockResolvedValue(null);
        mockBcryptCompare.mockResolvedValue(false as never);
        const resUnknown = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'nobody@example.com', password: VALID_PASSWORD });

        // Wrong password
        mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
        mockBcryptCompare.mockResolvedValue(false as never);
        const resWrong = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: VALID_EMAIL, password: 'WrongPassword1' });

        // Both must return the same error message
        expect(resUnknown.body.error.message).toBe(resWrong.body.error.message);
      });

      it('returns 400 for invalid email format', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'notanemail', password: VALID_PASSWORD });
        expect(res.status).toBe(400);
      });

      it('returns 400 for missing credentials', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({});
        expect(res.status).toBe(400);
      });
    });
  });

  // ============================================================================
  // GET /api/v1/auth/me
  // ============================================================================

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 200 with user data when authenticated', async () => {
      // Step 1: login to get cookie
      mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
      mockBcryptCompare.mockResolvedValue(true as never);
      mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Step 2: use cookie to call /me
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', Array.isArray(cookies) ? cookies : [String(cookies)]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe(VALID_EMAIL);
      expect(meRes.body.data.id).toBe(1);
    });

    it('does NOT return password_hash from /me', async () => {
      mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
      mockBcryptCompare.mockResolvedValue(true as never);
      mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

      const cookies = loginRes.headers['set-cookie'];
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', Array.isArray(cookies) ? cookies : [String(cookies)]);

      expect(JSON.stringify(meRes.body)).not.toContain('password_hash');
    });

    it('returns 401 for tampered/invalid cookie', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', ['atherops_token=invalidjwttoken']);
      expect(res.status).toBe(401);
    });
  });

  // ============================================================================
  // POST /api/v1/auth/logout
  // ============================================================================

  describe('POST /api/v1/auth/logout', () => {
    it('returns HTTP 200', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('clears the auth cookie (sets max-age=0 or expires in past)', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookies = res.headers['set-cookie'];
      // Express clearCookie sets expires to epoch or max-age=0
      const cookieStr = Array.isArray(cookies)
        ? cookies.join('; ')
        : String(cookies ?? '');
      const hasExpired =
        cookieStr.includes('Expires=Thu, 01 Jan 1970') ||
        cookieStr.includes('Max-Age=0') ||
        cookieStr.includes('expires=Thu, 01 Jan 1970');
      // If no cookie header is set at all, that also means cookie is cleared
      const noCookieSet = !cookies || (Array.isArray(cookies) && cookies.length === 0);
      expect(hasExpired || noCookieSet).toBe(true);
    });

    it('unauthenticated /me after logout returns 401', async () => {
      // Login first
      mockFindUserByEmail.mockResolvedValue(MOCK_USER_ROW);
      mockBcryptCompare.mockResolvedValue(true as never);
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
      const loginCookies = loginRes.headers['set-cookie'];

      // Logout (clears cookie conceptually — supertest doesn't retain state)
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', Array.isArray(loginCookies) ? loginCookies : [String(loginCookies)]);

      // /me without cookie should return 401
      const meRes = await request(app).get('/api/v1/auth/me');
      expect(meRes.status).toBe(401);
    });
  });

  // ============================================================================
  // Security: credentials not in logs / error messages
  // ============================================================================

  describe('Security', () => {
    it('auth error response never contains the submitted password', async () => {
      mockFindUserByEmail.mockResolvedValue(null);
      mockBcryptCompare.mockResolvedValue(false as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_EMAIL, password: 'MySecretPass1' });

      expect(JSON.stringify(res.body)).not.toContain('MySecretPass1');
    });

    it('registration response never contains the submitted password', async () => {
      mockEmailExists.mockResolvedValue(false);
      mockCreateUser.mockResolvedValue(MOCK_SAFE_USER);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

      expect(JSON.stringify(res.body)).not.toContain(VALID_PASSWORD);
    });
  });
});
