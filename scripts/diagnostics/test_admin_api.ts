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
    console.log('Login status:', loginRes.status);
    
    const cookieHeader = loginRes.headers.get('set-cookie');
    if (!cookieHeader) {
      console.error('No cookies returned on login!');
      return;
    }
    
    const config = {
      headers: {
        Cookie: cookieHeader
      }
    };
    
    const statsRes = await fetch('http://localhost:3001/api/v1/admin/stats', config);
    const stats = await statsRes.json();
    console.log('Stats:', JSON.stringify(stats, null, 2));
    
    const customersRes = await fetch('http://localhost:3001/api/v1/admin/customers', config);
    const customers = await customersRes.json() as any;
    console.log('Customers status:', customersRes.status);
    if (customers.data) {
      console.log('Customers count:', customers.data.length);
      console.log('First customer:', customers.data[0]);
    } else {
      console.log('Unexpected customers response:', customers);
    }

  } catch (err: any) {
    console.error('Error:', err);
  }
}

run();
