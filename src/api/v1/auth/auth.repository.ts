/**
 * AtherOps Backend – Auth Repository
 *
 * All SQL interactions with the users table live here.
 * Uses parameterised queries exclusively — no string concatenation.
 * Never returns password_hash in public-facing results.
 *
 * Note: pg's QueryResult<T> requires T extends Record<string, unknown>.
 * We use pg's QueryResultRow type instead of our domain types as the
 * generic, then cast after verifying row shape.
 */

import { getPool } from '../../../database';
import { UserRow, SafeUser } from './auth.types';

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Find a user by email.
 * Returns the full row including password_hash so the service layer
 * can verify the password before stripping it.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await getPool().query(
    'SELECT id, email, password_hash, role, status, created_at FROM users WHERE email = $1 LIMIT 1',
    [email],
  );
  const row = result.rows[0] as UserRow | undefined;
  return row ?? null;
}

/**
 * Find a user by primary key.
 * Returns a SafeUser — password_hash is excluded at the SQL level.
 */
export async function findUserById(id: number): Promise<SafeUser | null> {
  const result = await getPool().query(
    'SELECT id, email, role, status, created_at FROM users WHERE id = $1 LIMIT 1',
    [id],
  );
  const row = result.rows[0] as SafeUser | undefined;
  return row ?? null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert a new user and return the SafeUser (no password_hash).
 */
export async function createUser(
  email: string,
  passwordHash: string,
): Promise<SafeUser> {
  const result = await getPool().query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, role, status, created_at`,
    [email, passwordHash],
  );

  const row = result.rows[0] as SafeUser | undefined;
  if (!row) {
    throw new Error('Failed to create user: no row returned');
  }
  return row;
}

/**
 * Check whether an email address is already registered.
 * Uses EXISTS for efficiency — avoids fetching any column data.
 */
export async function emailExists(email: string): Promise<boolean> {
  const result = await getPool().query(
    'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists',
    [email],
  );
  const row = result.rows[0] as { exists: boolean } | undefined;
  return row?.exists === true;
}
