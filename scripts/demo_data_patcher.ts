import { getPool } from '../src/database';

async function patch() {
  const pool = getPool();
  try {
    const res = await pool.query("SELECT id, account_id, resource_type, attributes FROM resources");
    
    for (const row of res.rows) {
      let attrs = row.attributes || {};
      const acc = row.account_id;
      const type = row.resource_type;

      if (type === 'S3') {
        if (acc === 1) { // Secure
          attrs.encryptionEnabled = true;
          attrs.isPublic = false;
        } else if (acc === 2 || acc === 10) { // Public
          attrs.isPublic = true;
          attrs.encryptionEnabled = false;
        } else if (acc === 5) { // Encryption
          attrs.encryptionEnabled = false;
        } else {
          attrs.encryptionEnabled = true; // default secure
          attrs.isPublic = false;
        }
      }

      if (type === 'RDS') {
        if (acc === 1) { // Secure
          attrs.publiclyAccessible = false;
          attrs.storageEncrypted = true;
        } else if (acc === 2) {
          attrs.publiclyAccessible = true;
          attrs.storageEncrypted = false;
        } else if (acc === 5) {
          attrs.storageEncrypted = false;
        } else {
          attrs.publiclyAccessible = false;
          attrs.storageEncrypted = true;
        }
      }

      if (type === 'SECURITY_GROUP') {
        if (acc === 2 || acc === 7 || acc === 10) { // Public/Network/Enterprise
          attrs.ipPermissions = [{
            IpProtocol: 'tcp',
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: '0.0.0.0/0' }]
          }];
        } else {
          attrs.ipPermissions = [];
        }
      }

      if (type === 'IAM_USER') {
        if (acc === 3 || acc === 10) { // IAM Privilege - no MFA
          attrs.mfaEnabled = false;
        } else {
          attrs.mfaEnabled = true;
        }
      }

      if (type === 'IAM_ACCESS_KEY') {
        if (acc === 3) {
          attrs.createDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days old
        } else {
          attrs.createDate = new Date().toISOString();
        }
      }

      if (type === 'IAM_ROLE') {
        if (acc === 3 || acc === 9 || acc === 10) { // IAM / Lambda / Enterprise
          attrs.policyDocument = {
            Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }]
          };
        } else {
          attrs.policyDocument = {};
        }
      }

      await pool.query('UPDATE resources SET attributes = $1 WHERE id = $2', [attrs, row.id]);
    }
    console.log('Patch complete.');
  } finally {
    await pool.end();
  }
}
patch();
