/**
 * AtherOps Backend – API v1 Router
 *
 * All v1 routes are registered here.
 * Future modules (auth, users, projects, cloud-accounts, etc.)
 * will each add their own router to this file.
 */

import { Router } from 'express';
import { healthRouter } from './health/health.routes';
import { authRouter } from './auth/auth.routes';
import { projectsRouter } from './projects/project.routes';
import { adminRouter } from './admin/admin.routes';

const v1Router = Router();

// ── Health ─────────────────────────────────────────────────────────────────────
v1Router.use('/health', healthRouter);

// ── Auth ──────────────────────────────────────────────────────────────────────
v1Router.use('/auth', authRouter);

// ── Admin ─────────────────────────────────────────────────────────────────────
v1Router.use('/admin', adminRouter);

// ── Future phase modules (add below as they are implemented) ──────────────────
// v1Router.use('/users',          usersRouter);

v1Router.use('/projects',       projectsRouter);
// v1Router.use('/cloud-accounts', cloudAccountsRouter);
// v1Router.use('/resources',      resourcesRouter);
// v1Router.use('/findings',       findingsRouter);
// v1Router.use('/risk',           riskRouter);
// v1Router.use('/recommendations',recommendationsRouter);
// v1Router.use('/attack-paths',   attackPathsRouter);
// v1Router.use('/dashboard',      dashboardRouter);

export { v1Router };
