import * as dotenv from 'dotenv';
dotenv.config();

async function getCookies(email: string) {
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'DemoPassword123!' })
  });
  const cookieHeader = loginRes.headers.get('set-cookie');
  return cookieHeader || null;
}

async function run() {
  const c1Cookie = await getCookies('customer1@example.com');
  const c2Cookie = await getCookies('customer2@example.com');

  if (!c1Cookie || !c2Cookie) {
    console.error('Failed to get cookies for test users. Is server running and passwords correct?');
    return;
  }
  const config1 = { headers: { Cookie: c1Cookie } };
  const config2 = { headers: { Cookie: c2Cookie } };

  // 1. Get projects for Customer 1
  const p1Res = await fetch('http://localhost:3001/api/v1/projects', config1);
  const p1Data = await p1Res.json() as any;
  const c1Projects = p1Data.data || [];
  if (c1Projects.length === 0) {
    console.log('Customer 1 has no projects to test with.');
    return;
  }
  const targetProjectId = c1Projects[0].id;

  // 2. Get projects for Customer 2
  const p2Res = await fetch('http://localhost:3001/api/v1/projects', config2);
  const p2Data = await p2Res.json() as any;
  const c2Projects = p2Data.data || [];
  const c2ProjectId = c2Projects.length > 0 ? c2Projects[0].id : null;

  if (c2ProjectId) {
    // 3. Attempt IDOR on resources: Get resource from Customer 1 and try to access via Customer 2's project
    const c1ResList = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}/resources`, config1);
    const c1ResourcesData = await c1ResList.json() as any;
    const c1Resources = c1ResourcesData.data || [];
    if (c1Resources.length > 0) {
      const targetResourceId = c1Resources[0].id;
      console.log(`\n--- IDOR TEST 5: Access Resource of Project 1 via Project 2 ---`);
      // It depends on the API structure. AtherOps uses /projects/:projectId/resources/:resourceId (maybe).
      const idorRes = await fetch(`http://localhost:3001/api/v1/projects/${c2ProjectId}/resources/${targetResourceId}`, config2);
      console.log(`Access Resource ${targetResourceId} via Project ${c2ProjectId} as Customer 2: STATUS ${idorRes.status}`);
      if (idorRes.status === 200) {
        console.log('VULNERABILITY FOUND: Accessed resource from another project!');
      }
    }
  }

  // 4. Test Cloud Account update
  const c1Accounts = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}/cloud-accounts`, config1);
  const c1AccData = await c1Accounts.json() as any;
  if (c1AccData.data && c1AccData.data.length > 0) {
    const targetAccountId = c1AccData.data[0].id;
    console.log(`\n--- IDOR TEST 6: Modify Cloud Account via API directly ---`);
    // Even if I use targetProjectId, config2 (Customer 2) is used. This is covered by TEST 1 (Project Access).
    const idorUpdate = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}/cloud-accounts/${targetAccountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: c2Cookie },
      body: JSON.stringify({ account_name: 'Hacked Name' })
    });
    console.log(`Update Cloud Account ${targetAccountId} in Project ${targetProjectId} as Customer 2: STATUS ${idorUpdate.status}`);
  }

  // 5. Check if JWT returns sensitive info in payload?
  console.log(`\n--- JWT INSPECTION ---`);
  // Not decoding JWT here, but backend /auth/me can be checked
  const meRes = await fetch('http://localhost:3001/api/v1/auth/me', config1);
  const meData = await meRes.json() as any;
  console.log('Auth /me data:', Object.keys(meData.data));
  if (meData.data.password_hash || meData.data.password) {
    console.log('VULNERABILITY FOUND: Password hash returned in /me!');
  } else {
    console.log('No password hash in /me');
  }

}

run().catch(console.error);
