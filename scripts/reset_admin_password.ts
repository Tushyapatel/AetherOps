import { getPool } from '../src/database';
import { hashPassword } from '../src/api/v1/auth/auth.service';

async function run() {
  const pool = getPool();
  try {
    const newPassword = 'Password123!';
    console.log('Generating hash for new password...');
    const hashed = await hashPassword(newPassword);
    
    console.log('Updating database for admin@aetherops.local...');
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
      [hashed, 'admin@aetherops.local']
    );

    if (result.rowCount === 0) {
      console.log('User admin@aetherops.local not found.');
    } else {
      console.log('Password successfully updated for user:', result.rows[0].email);
      console.log('New Password is: ' + newPassword);
    }
  } catch (err) {
    console.error('Error updating password:', err);
  } finally {
    await pool.end();
  }
}
run();
