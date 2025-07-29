import { test, expect } from '@playwright/test';

test.describe('Debug Single Endpoint', () => {
  test('debug files endpoint response', async ({ request }) => {
    // Test the files endpoint directly
    const fileResponse = await request.get('/api/files/1');
    
    console.log('Response status:', fileResponse.status());
    console.log('Response ok:', fileResponse.ok());
    
    const responseBody = await fileResponse.text();
    console.log('Response body:', responseBody);
    
    try {
      const jsonData = JSON.parse(responseBody);
      console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('Failed to parse as JSON:', e);
    }
  });
});