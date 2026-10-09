import { getPool } from '../../../database';


export async function getPlatformStats() {
  const pool = getPool();
  
  const customersRes = await pool.query(`SELECT COUNT(*) FROM users WHERE role IN ('CUSTOMER', 'viewer')`);
  const activeUsersRes = await pool.query(`SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'`);
  const blockedUsersRes = await pool.query(`SELECT COUNT(*) FROM users WHERE status = 'BLOCKED'`);
  const projectsRes = await pool.query(`SELECT COUNT(*) FROM projects`);
  const accountsRes = await pool.query(`SELECT COUNT(*) FROM cloud_accounts`);
  
  const liveAccountsRes = await pool.query(`SELECT COUNT(*) FROM cloud_accounts WHERE mode = 'LIVE'`);
  const demoAccountsRes = await pool.query(`SELECT COUNT(*) FROM cloud_accounts WHERE mode = 'DEMO'`);
  
  const findingsRes = await pool.query(`
    SELECT severity, COUNT(*) 
    FROM findings 
    WHERE status = 'OPEN' 
    GROUP BY severity
  `);
  
  const findingCounts = findingsRes.rows.reduce((acc, row) => {
    acc[row.severity] = parseInt(row.count);
    return acc;
  }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });

  const resourcesRes = await pool.query(`SELECT COUNT(*) FROM resources`);
  const attackPathsRes = await pool.query(`SELECT COUNT(*) FROM attack_paths`);
  const analysisRunsRes = await pool.query(`SELECT COUNT(*) FROM analysis_runs`);

  return {
    totalCustomers: parseInt(customersRes.rows[0].count),
    activeUsers: parseInt(activeUsersRes.rows[0].count),
    blockedUsers: parseInt(blockedUsersRes.rows[0].count),
    totalProjects: parseInt(projectsRes.rows[0].count),
    connectedCloudAccounts: parseInt(accountsRes.rows[0].count),
    liveCloudAccounts: parseInt(liveAccountsRes.rows[0].count),
    demoCloudAccounts: parseInt(demoAccountsRes.rows[0].count),
    openFindings: findingCounts,
    totalResources: parseInt(resourcesRes.rows[0].count),
    totalAttackPaths: parseInt(attackPathsRes.rows[0].count),
    totalAnalysisRuns: parseInt(analysisRunsRes.rows[0].count)
  };
}

export async function getCustomers() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT u.id, u.email, u.role, u.status, u.created_at,
           (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) as project_count,
           (SELECT COUNT(*) FROM cloud_accounts c JOIN projects p ON c.project_id = p.id WHERE p.user_id = u.id) as cloud_account_count
    FROM users u
    WHERE u.role IN ('CUSTOMER', 'viewer')
    ORDER BY u.created_at DESC
  `);
  return res.rows;
}

export async function updateCustomerStatus(userId: number, status: 'ACTIVE' | 'BLOCKED') {
  const pool = getPool();
  const res = await pool.query(`
    UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, role, status, created_at
  `, [status, userId]);
  return res.rows[0];
}

export async function getAdminCloudAccounts() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT c.id, c.account_name, c.account_id, c.environment, c.mode, c.last_scanned_at,
           p.name as project_name, u.email as owner_email
    FROM cloud_accounts c
    JOIN projects p ON c.project_id = p.id
    JOIN users u ON p.user_id = u.id
    ORDER BY c.created_at DESC
  `);
  return res.rows;
}

export async function getAuditLogs(limit: number = 100) {
  const pool = getPool();
  const res = await pool.query(`
    SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

export async function getProjects() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT p.id, p.name, p.description, p.created_at, 'ACTIVE' as status, u.email as owner_email,
           (SELECT COUNT(*) FROM cloud_accounts c WHERE c.project_id = p.id) as cloud_account_count,
           (SELECT COUNT(*) FROM resources r JOIN cloud_accounts c ON r.account_id = c.id WHERE c.project_id = p.id) as resource_count,
           (SELECT COUNT(*) FROM findings f JOIN cloud_accounts c ON f.account_id = c.id WHERE c.project_id = p.id AND f.status = 'OPEN') as finding_count
    FROM projects p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `);
  return res.rows;
}

export async function deleteCustomer(adminUserId: number, targetUserId: number) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Verify target exists and is a CUSTOMER
    const userRes = await client.query('SELECT role, email FROM users WHERE id = $1 FOR UPDATE', [targetUserId]);
    if (userRes.rowCount === 0) {
      throw new Error('User not found');
    }
    const user = userRes.rows[0];
    
    if (user.role !== 'CUSTOMER' && user.role !== 'viewer') {
      throw new Error('User is not a customer');
    }
    
    // 2. Delete costs related to this user
    await client.query(`
      DELETE FROM costs 
      WHERE account_id IN (
        SELECT id FROM cloud_accounts WHERE user_id = $1
      )
    `, [targetUserId]);

    // 3. Create deletion audit record safely
    await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      adminUserId, 
      'CUSTOMER_DELETED', 
      'USER', 
      targetUserId, 
      JSON.stringify({ targetUserId, email: user.email })
    ]);
    
    // 4. Delete the user
    await client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

