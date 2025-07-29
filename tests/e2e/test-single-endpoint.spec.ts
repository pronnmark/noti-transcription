import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Debug Upload and Retrieve', () => {
  test('debug upload then retrieve file', async ({ request }) => {
    // First upload a file
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const formData = new FormData();
    const blob = new Blob([testFile.buffer], { type: testFile.contentType });
    formData.append('file', blob, testFile.name);

    console.log('=== UPLOAD TEST ===');
    const uploadResponse = await request.post('/api/upload', {
      multipart: formData,
    });

    console.log('Upload status:', uploadResponse.status());
    console.log('Upload ok:', uploadResponse.ok());
    
    const uploadBody = await uploadResponse.text();
    console.log('Upload response:', uploadBody);

    if (uploadResponse.ok()) {
      const uploadData = JSON.parse(uploadBody);
      const fileId = uploadData.data.results[0]?.fileId;
      console.log('Uploaded file ID:', fileId);

      if (fileId) {
        console.log('\n=== RETRIEVE TEST ===');
        // Now try to retrieve it
        const fileResponse = await request.get(`/api/files/${fileId}`);
        
        console.log('Retrieve status:', fileResponse.status());
        console.log('Retrieve ok:', fileResponse.ok());
        
        const responseBody = await fileResponse.text();
        console.log('Retrieve response:', responseBody);
      }
    }
  });
});