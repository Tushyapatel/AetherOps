/**
 * AtherOps Backend – Project Types
 *
 * Shared TypeScript types for the project module.
 */

// ── Database row type ─────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string; // bigint maps to string in node-postgres by default unless parsed
  user_id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

// ── Public project type ───────────────────────────────────────────────────────

export interface Project {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
