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
  console.log(`Customer 1 Project ID: ${targetProjectId}`);

  // 2. Attempt to access Customer 1's project using Customer 2's session
  console.log('\\n--- IDOR TEST 1: Cross-Tenant Project Access ---');
  const idorRes = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}`, config2);
  console.log(`Access Project ${targetProjectId} as Customer 2: STATUS ${idorRes.status}`);

  console.log('\\n--- IDOR TEST 2: Cross-Tenant Cloud Accounts Access ---');
  const idorCloudRes = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}/cloud-accounts`, config2);
  console.log(`Access Cloud Accounts for Project ${targetProjectId} as Customer 2: STATUS ${idorCloudRes.status}`);

  console.log('\\n--- IDOR TEST 3: Cross-Tenant AI Chat Access ---');
  const idorAiRes = await fetch(`http://localhost:3001/api/v1/projects/${targetProjectId}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: c2Cookie },
    body: JSON.stringify({ message: "What is my project?" })
  });
  console.log(`Access AI Chat for Project ${targetProjectId} as Customer 2: STATUS ${idorAiRes.status}`);

  console.log('\\n--- IDOR TEST 4: Cross-Tenant Admin Route ---');
  const adminRes = await fetch(`http://localhost:3001/api/v1/admin/stats`, config1);
  console.log(`Access Admin Stats as Customer 1: STATUS ${adminRes.status}`);

}

run().catch(console.error);
