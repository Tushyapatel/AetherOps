import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../src/database';
import * as adminService from '../src/api/v1/admin/admin.service';

async function testDynamicCounts() {
  console.log('[DYNAMIC ADMIN COUNT TEST]');
  const pool = getPool();
  try {
    const statsBefore = await adminService.getPlatformStats();
    console.log(`Original Cloud Account Count: ${statsBefore.connectedCloudAccounts}`);
    
    // Add isolated record
    const result = await pool.query(
      `INSERT INTO cloud_accounts (project_id, account_name, role_arn, external_id) 
       VALUES (1, 'Test Account Dynamic', 'arn:aws:iam::123:role/test', 'ext-123') RETURNING account_id`
    );
    const isolatedId = result.rows[0].account_id;
    
    const statsAfter = await adminService.getPlatformStats();
    console.log(`Cloud Account Count after adding: ${statsAfter.connectedCloudAccounts}`);
    
    if (statsAfter.connectedCloudAccounts === statsBefore.connectedCloudAccounts + 1) {
      console.log('Dynamic Admin Count: PASS');
    } else {
      console.log('Dynamic Admin Count: FAIL');
    }

    // Cleanup isolated record
    await pool.query(`DELETE FROM cloud_accounts WHERE account_id = $1`, [isolatedId]);
    
    const statsCleaned = await adminService.getPlatformStats();
    console.log(`Cloud Account Count after cleanup: ${statsCleaned.connectedCloudAccounts}`);
  } catch (err) {
    console.error('Error in dynamic counts:', err);
  } finally {
    await pool.end();
  }
}

testDynamicCounts();
