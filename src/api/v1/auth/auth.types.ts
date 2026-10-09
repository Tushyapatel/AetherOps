/**
 * AtherOps Backend – Auth Types
 *
 * Shared TypeScript types for the authentication module.
 * Keeping types in a dedicated file avoids circular imports.
 */

// ── Database row type ─────────────────────────────────────────────────────────

/** Row returned from the users table — never expose password_hash to clients */
export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: 'admin' | 'viewer' | 'ADMIN' | 'CUSTOMER' | 'PLATFORM_ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  created_at: Date;
}

// ── Safe public user (never includes password_hash) ───────────────────────────

export interface SafeUser {
  id: number;
  email: string;
  role: 'admin' | 'viewer' | 'ADMIN' | 'CUSTOMER' | 'PLATFORM_ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  created_at: Date;
}

// ── JWT payload shape ─────────────────────────────────────────────────────────

export interface JwtPayload {
  /** Subject — user id as string (JWT standard) */
  sub: string;
  email: string;
  role: 'admin' | 'viewer' | 'ADMIN' | 'CUSTOMER' | 'PLATFORM_ADMIN';
}

// ── Express request augmentation ──────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by requireAuth middleware after successful JWT verification */
      user?: SafeUser;
    }
  }
}
