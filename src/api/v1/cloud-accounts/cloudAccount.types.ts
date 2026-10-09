/**
 * AtherOps Backend – Cloud Account Types
 */

export interface CloudAccountRow {
  id: number;
  user_id: number;
  project_id: string | null; // bigint maps to string in pg
  provider: string;
  account_id: string;
  account_name: string;
  environment: string | null;
  region: string;
  mode: string;
  description: string | null;
  role_arn: string | null;
  external_id: string;
  created_at: Date;
  last_scanned_at: Date | null;
}

export interface CloudAccount {
  id: number;
  userId: number;
  projectId: string | null;
  provider: string;
  accountId: string;
  accountName: string;
  environment: string | null;
  region: string;
  mode: string;
  description: string | null;
  roleArn: string | null;
  createdAt: Date;
  lastScannedAt: Date | null;
}

export interface CloudAccountSetup {
  accountId: string;
  provider: string;
  roleArn: string | null;
  externalId: string;
  setupInstructions: string;
}
