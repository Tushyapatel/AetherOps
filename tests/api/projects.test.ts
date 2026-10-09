/**
 * AtherOps – Test: Project Endpoints
 *
 * Tests for project management CRUD APIs.
 * Database calls and auth verification are mocked.
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import jwt from 'jsonwebtoken';

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
  findUserById: jest.fn(),
}));

// ── Mock the project repository ───────────────────────────────────────────────
jest.mock('../../src/api/v1/projects/project.repository', () => ({
  findProjectsByUserId: jest.fn(),
  findProjectByIdAndUserId: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  checkProjectNameExists: jest.fn(),
}));

import { findUserById } from '../../src/api/v1/auth/auth.repository';
import {
  findProjectsByUserId,
  findProjectByIdAndUserId,
  createProject,
  updateProject,
  deleteProject,
  checkProjectNameExists,
} from '../../src/api/v1/projects/project.repository';

const mockFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockFindProjectsByUserId = findProjectsByUserId as jest.MockedFunction<typeof findProjectsByUserId>;
const mockFindProjectByIdAndUserId = findProjectByIdAndUserId as jest.MockedFunction<typeof findProjectByIdAndUserId>;
const mockCreateProject = createProject as jest.MockedFunction<typeof createProject>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;
const mockDeleteProject = deleteProject as jest.MockedFunction<typeof deleteProject>;
const mockCheckProjectNameExists = checkProjectNameExists as jest.MockedFunction<typeof checkProjectNameExists>;

// ── Shared test fixtures ──────────────────────────────────────────────────────

const MOCK_USER_ID = 1;
const OTHER_USER_ID = 2;
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-at-least-32-characters-long!!';

const MOCK_SAFE_USER = {
  id: MOCK_USER_ID,
  email: 'test@example.com',
  role: 'viewer' as const,
  status: 'ACTIVE' as const,
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const MOCK_PROJECT = {
  id: '100',
  user_id: MOCK_USER_ID,
  name: 'Test Project',
  description: 'Test Description',
  created_at: new Date(),
  updated_at: new Date(),
};

function generateAuthCookie(userId: number = MOCK_USER_ID) {
  const token = jwt.sign({ sub: String(userId), email: 'test@example.com', role: 'viewer' as const,
  status: 'ACTIVE', }, JWT_SECRET, {
    issuer: 'atherops',
    audience: 'atherops-api',
  });
  return `atherops_token=${token}`;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Project Endpoints', () => {
  const app = createApp();
  const validCookie = generateAuthCookie(MOCK_USER_ID);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserById.mockResolvedValue(MOCK_SAFE_USER);
  });

  // ============================================================================
  // POST /api/v1/projects
  // ============================================================================

  describe('POST /api/v1/projects', () => {
    it('creates a project successfully', async () => {
      mockCheckProjectNameExists.mockResolvedValue(false);
      mockCreateProject.mockResolvedValue(MOCK_PROJECT);

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', [validCookie])
        .send({ name: 'Test Project', description: 'Test Description' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Project');
      expect(mockCreateProject).toHaveBeenCalledWith(MOCK_USER_ID, 'Test Project', 'Test Description');
    });

    it('rejects unauthenticated requests (401)', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Test Project' });
      
      expect(res.status).toBe(401);
    });

    it('rejects invalid inputs (400)', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', [validCookie])
        .send({ name: '' }); // empty name
      
      expect(res.status).toBe(400);
    });

    it('ignores client-supplied user_id', async () => {
      mockCheckProjectNameExists.mockResolvedValue(false);
      mockCreateProject.mockResolvedValue(MOCK_PROJECT);

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', [validCookie])
        .send({ name: 'Test Project', userId: 999 });

      expect(res.status).toBe(201);
      // Ensure the service was called with the AUTHENTICATED user id, not the fake one
      expect(mockCreateProject).toHaveBeenCalledWith(MOCK_USER_ID, 'Test Project', null);
    });

    it('handles duplicate project names (409)', async () => {
      mockCheckProjectNameExists.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', [validCookie])
        .send({ name: 'Duplicate Name' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  // ============================================================================
  // GET /api/v1/projects
  // ============================================================================

  describe('GET /api/v1/projects', () => {
    it('lists only projects belonging to the user', async () => {
      mockFindProjectsByUserId.mockResolvedValue([MOCK_PROJECT]);

      const res = await request(app)
        .get('/api/v1/projects')
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(MOCK_PROJECT.id);
      expect(mockFindProjectsByUserId).toHaveBeenCalledWith(MOCK_USER_ID);
    });
  });

  // ============================================================================
  // GET /api/v1/projects/:projectId
  // ============================================================================

  describe('GET /api/v1/projects/:projectId', () => {
    it('returns the project if the owner requests it', async () => {
      mockFindProjectByIdAndUserId.mockResolvedValue(MOCK_PROJECT);

      const res = await request(app)
        .get(`/api/v1/projects/${MOCK_PROJECT.id}`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(MOCK_PROJECT.id);
      expect(mockFindProjectByIdAndUserId).toHaveBeenCalledWith(MOCK_PROJECT.id, MOCK_USER_ID);
    });

    it('returns 404 if project not found or belongs to another user', async () => {
      mockFindProjectByIdAndUserId.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/projects/999')
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
    
    it('returns 400 for invalid project ID format', async () => {
      const res = await request(app)
        .get('/api/v1/projects/abc') // non-numeric
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // PATCH /api/v1/projects/:projectId
  // ============================================================================

  describe('PATCH /api/v1/projects/:projectId', () => {
    it('updates project details if owner', async () => {
      mockFindProjectByIdAndUserId.mockResolvedValue(MOCK_PROJECT);
      mockCheckProjectNameExists.mockResolvedValue(false);
      mockUpdateProject.mockResolvedValue({ ...MOCK_PROJECT, name: 'New Name' });

      const res = await request(app)
        .patch(`/api/v1/projects/${MOCK_PROJECT.id}`)
        .set('Cookie', [validCookie])
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(mockUpdateProject).toHaveBeenCalledWith(MOCK_PROJECT.id, MOCK_USER_ID, 'New Name', MOCK_PROJECT.description);
    });

    it('returns 404 if project not found or belongs to another user', async () => {
      mockFindProjectByIdAndUserId.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/projects/999')
        .set('Cookie', [validCookie])
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });

    it('handles duplicate name on update', async () => {
      mockFindProjectByIdAndUserId.mockResolvedValue(MOCK_PROJECT);
      mockCheckProjectNameExists.mockResolvedValue(true); // Exists!

      const res = await request(app)
        .patch(`/api/v1/projects/${MOCK_PROJECT.id}`)
        .set('Cookie', [validCookie])
        .send({ name: 'Duplicate Name' });

      expect(res.status).toBe(409);
    });
  });

  // ============================================================================
  // DELETE /api/v1/projects/:projectId
  // ============================================================================

  describe('DELETE /api/v1/projects/:projectId', () => {
    it('deletes the project if owner', async () => {
      mockDeleteProject.mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/projects/${MOCK_PROJECT.id}`)
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(mockDeleteProject).toHaveBeenCalledWith(MOCK_PROJECT.id, MOCK_USER_ID);
    });

    it('returns 404 if project not found or belongs to another user', async () => {
      mockDeleteProject.mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/v1/projects/999')
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(404);
    });
  });
});
