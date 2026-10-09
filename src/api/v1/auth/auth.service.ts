/**
 * AtherOps Backend – Auth Service
 *
 * Business logic for authentication:
 *  - Password hashing with bcrypt (cost factor 12)
 *  - JWT signing and verification
 *  - User registration
 *  - User login
 *
 * bcrypt is chosen over Argon2id because:
 *  - It is natively available via the `bcrypt` npm package with native bindings
 *  - Cost factor 12 provides strong brute-force resistance (~250ms on modern hardware)
 *  - Well-tested, battle-hardened in Node.js production environments
 *  - Argon2id would be preferable in a new greenfield project but adds a native
 *    module dependency with more complex Windows build requirements
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { logger } from '../../../logger';
import { ConflictError, UnauthorizedError } from '../../../errors';
import {
  findUserByEmail,
  createUser,
  emailExists,
} from './auth.repository';
import { SafeUser, JwtPayload } from './auth.types';
import type { RegisterInput, LoginInput } from './auth.validation';

// ── Constants ─────────────────────────────────────────────────────────────────

/** bcrypt cost factor — increase if hardware improves */
const BCRYPT_ROUNDS = 12;

// ── Password utilities ────────────────────────────────────────────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ── JWT utilities ─────────────────────────────────────────────────────────────

export function signToken(user: SafeUser): string {
  const payload: JwtPayload = {
    sub: String(user.id),
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithms: ['HS256'],
  });

  // jwt.verify returns string | JwtPayload — narrow to our shape
  if (typeof decoded === 'string' || !decoded.sub) {
    throw new UnauthorizedError('Invalid token payload');
  }

  return decoded as unknown as JwtPayload;
}

// ── Auth operations ───────────────────────────────────────────────────────────

/**
 * Register a new user.
 *
 * @throws ConflictError if email is already registered
 */
export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const { email, password } = input;

  // Check for duplicate — use generic message to avoid email enumeration
  const exists = await emailExists(email);
  if (exists) {
    logger.warn('Registration attempt with existing email', {
      // Log a hint for admins but do NOT log the email itself
      hint: 'duplicate_email',
    });
    throw new ConflictError('An account with that email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await createUser(email, passwordHash);

  logger.info('User registered successfully', { userId: user.id, role: user.role });

  return user;
}

/**
 * Authenticate a user with email + password.
 *
 * Uses a generic error message for ALL failures to prevent email enumeration.
 *
 * @throws UnauthorizedError for any authentication failure
 */
export async function loginUser(input: LoginInput): Promise<SafeUser> {
  const { email, password } = input;

  // Always run bcrypt even if user not found — constant-time behaviour
  const DUMMY_HASH = '$2b$12$invalidhashfortimingnormalization..........';

  const user = await findUserByEmail(email);

  const hashToCompare = user?.password_hash ?? DUMMY_HASH;
  const passwordMatch = await verifyPassword(password, hashToCompare);

  if (!user || !passwordMatch) {
    // Same message regardless of whether email or password was wrong
    logger.warn('Failed login attempt', { hint: 'invalid_credentials' });
    throw new UnauthorizedError('Invalid email or password');
  }

  logger.info('User logged in successfully', { userId: user.id, role: user.role });

  // Return SafeUser — strip password_hash
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}
