import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'platform_admin@atherops.com',
        password: 'Test1234!'
      })
    });
    
    const cookieHeader = loginRes.headers.get('set-cookie');
    const config = { headers: { Cookie: cookieHeader! } };
    
    const endpoints = [
      '/api/v1/admin/stats',
      '/api/v1/admin/customers',
      '/api/v1/admin/projects',
      '/api/v1/admin/cloud-accounts',
      '/api/v1/admin/audit-logs?limit=50'
    ];
    
    for (const ep of endpoints) {
      const res = await fetch(`http://localhost:3001${ep}`, config);
      if (!res.ok) {
        console.log(`${ep} -> FAILED: ${res.status}`);
        const text = await res.text();
        console.log(text);
      } else {
        console.log(`${ep} -> OK`);
      }
    }
  } catch (err: any) {
    console.error('Error:', err);
  }
}

run();
