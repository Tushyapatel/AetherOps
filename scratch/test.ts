import { disconnectCloudAccount } from '../../src/api/v1/cloud-accounts/cloudAccount.repository';
import { checkDbHealth } from '../../src/database';

async function run() {
  await checkDbHealth();
  const res = await disconnectCloudAccount(9999, '9999', 1);
  console.log('Disconnect Result:', res);
  process.exit(0);
}

run().catch(console.error);
