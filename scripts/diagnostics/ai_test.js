const http = require('http');

const data = JSON.stringify({
  message: "Give me an overview of my security posture.",
  contextType: "OVERVIEW"
});

const req = http.request({
  hostname: 'localhost',
  port: 3001, // Assuming backend is on 3001
  path: '/api/v1/projects/7/ai/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Cookie': 'auth_token=developer_demo_token_123' // Try passing standard token, though we might need a real one
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
