import { getPool } from '../src/database';

async function fixAdminRole() {
  const pool = getPool();
  try {
    console.log('Updating role constraints...');
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'viewer', 'ADMIN', 'CUSTOMER', 'PLATFORM_ADMIN'))`);
    
    console.log('Updating platform admin role...');
    const result = await pool.query(
      `UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = 'platform_admin@atherops.com'`
    );
    console.log(`Updated ${result.rowCount} user(s).`);
  } catch (e) {
    console.error('Failed:', e);
  } finally {
    await pool.end();
  }
}
fixAdminRole();
