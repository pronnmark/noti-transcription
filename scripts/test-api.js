const fetch = require('node-fetch');

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  const endpoints = [
    { url: 'http://localhost:5173/api/health', method: 'GET' },
    { url: 'http://localhost:5173/api/worker/transcribe', method: 'GET' },
    { url: 'http://localhost:5173/api/files', method: 'GET' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.url}`);
      const response = await fetch(endpoint.url, { method: endpoint.method });
      const text = await response.text();
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      console.log('---\n');
    } catch (error) {
      console.log(`Error: ${error.message}`);
      console.log('---\n');
    }
  }
}

testAPI().catch(console.error);