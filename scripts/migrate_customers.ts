import { getPool } from '../src/database';
import bcrypt from 'bcrypt';

async function runMigration() {
  const pool = getPool();
  try {
    console.log('Adding status column and dropping old role constraint...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ACTIVE'`);
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'viewer', 'ADMIN', 'CUSTOMER'))`);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('DemoPassword123!', salt);

    // 1. New Platform Admin
    console.log('Creating New Platform Admin...');
    const adminRes = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
      ['platform_admin@atherops.com', passwordHash, 'ADMIN']
    );
    const platformAdminId = adminRes.rows[0].id;

    // 2. Customers
    console.log('Creating 3 Customer Personas...');
    const customers = [
      { email: 'customer1@example.com', name: 'Customer 1 Project' },
      { email: 'customer2@example.com', name: 'Customer 2 Project' },
      { email: 'customer3@example.com', name: 'Customer 3 Project' }
    ];

    const customerUserIds = [];
    const customerProjectIds = [];

    for (const c of customers) {
      const userRes = await pool.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
        [c.email, passwordHash, 'CUSTOMER']
      );
      customerUserIds.push(userRes.rows[0].id);

      const projRes = await pool.query(
        `INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
        [userRes.rows[0].id, c.name, `Dedicated project for ${c.name}`]
      );
      customerProjectIds.push(projRes.rows[0].id);
    }

    // 3. Map accounts
    console.log('Mapping accounts to customer projects...');
    // Account #1 -> Project 1
    await pool.query(`UPDATE cloud_accounts SET project_id = $1 WHERE account_id = '100000000001'`, [customerProjectIds[0]]);
    // Account #5 -> Project 2
    await pool.query(`UPDATE cloud_accounts SET project_id = $1 WHERE account_id = '100000000005'`, [customerProjectIds[1]]);
    // Account #10 -> Project 3
    await pool.query(`UPDATE cloud_accounts SET project_id = $1 WHERE account_id = '100000000010'`, [customerProjectIds[2]]);

    console.log('Migration completed.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}
runMigration();
