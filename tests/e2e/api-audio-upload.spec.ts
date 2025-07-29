import { test, expect, APIRequestContext } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { SupabaseTestManager } from '../utils/supabase-test-manager';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

test.describe('Audio Upload API Tests', () => {
  let supabaseManager: SupabaseTestManager;
  let uploadedFileIds: number[] = [];
  let uploadedPaths: string[] = [];

  test.beforeAll(async () => {
    // Set up test environment
    await TestHelpers.setupTestEnvironment();
    supabaseManager = new SupabaseTestManager();
    await supabaseManager.setup();

    // Ensure test database is clean
    const testDbPath = './test-e2e.db';
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  test.afterAll(async () => {
    // Cleanup uploaded files from Supabase
    if (uploadedPaths.length > 0) {
      try {
        await TestHelpers.cleanupTestFiles('audio-files', uploadedPaths);
      } catch (error) {
        console.warn('Failed to cleanup Supabase files:', error);
      }
    }

    // Cleanup test environment
    if (supabaseManager) {
      await supabaseManager.cleanup();
    }
    await TestHelpers.cleanupTestEnvironment();
  });

  test.afterEach(async ({ request }) => {
    // Cleanup any files created during the test
    for (const fileId of uploadedFileIds) {
      try {
        await request.delete(`/api/files/${fileId}`);
      } catch (error) {
        console.warn(`Failed to cleanup file ${fileId}:`, error);
      }
    }
    uploadedFileIds = [];
  });

  test('should successfully upload a small MP3 file via API', async ({ request }) => {
    // Get test file
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Create FormData with the file
    const formData = new FormData();
    const blob = new Blob([testFile.buffer], { type: testFile.contentType });
    formData.append('file', blob, testFile.name);

    // Make the upload request
    const response = await request.post('/api/upload', {
      multipart: formData,
    });

    // Debug response if not ok
    if (!response.ok()) {
      const errorText = await response.text();
      console.error('Upload failed:', {
        status: response.status(),
        statusText: response.statusText(),
        body: errorText
      });
    }

    // Verify response
    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    // Verify response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.totalFiles).toBe(1);
    expect(responseData.data.successCount).toBe(1);
    expect(responseData.data.failureCount).toBe(0);
    expect(responseData.data.results).toHaveLength(1);

    const result = responseData.data.results[0];
    expect(result.success).toBe(true);
    expect(result.fileId).toBeDefined();
    expect(result.fileName).toBe(testFile.name);
    expect(result.message).toContain('uploaded successfully');
    expect(result.duration).toBeDefined();

    // Track for cleanup
    uploadedFileIds.push(result.fileId);

    // Verify file exists in database
    const fileResponse = await request.get(`/api/files/${result.fileId}`);
    expect(fileResponse.ok()).toBeTruthy();
    
    const fileData = await fileResponse.json();
    expect(fileData.success).toBe(true);
    expect(fileData.data).toBeDefined();
    expect(fileData.data.originalFileName).toBe(testFile.name);
    expect(fileData.data.fileSize).toBe(testFile.size);
    
    // Track file path for Supabase cleanup
    uploadedPaths.push(fileData.data.fileName);

    // Verify file exists in Supabase Storage
    const fileExists = await supabaseManager.fileExists('audio-files', fileData.data.fileName);
    expect(fileExists).toBe(true);

    console.log(`✅ Successfully uploaded file ${result.fileId}: ${testFile.name}`);
  });

  test('should successfully upload a WAV file via API', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-medium.wav');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.contentType,
          buffer: testFile.buffer,
        }
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    expect(responseData.success).toBe(true);
    expect(responseData.data.results[0].success).toBe(true);
    
    const result = responseData.data.results[0];
    uploadedFileIds.push(result.fileId);

    // Verify file metadata
    const fileResponse = await request.get(`/api/files/${result.fileId}`);
    const fileData = await fileResponse.json();
    uploadedPaths.push(fileData.data.fileName);

    // Verify in Supabase
    const fileExists = await supabaseManager.fileExists('audio-files', fileData.data.fileName);
    expect(fileExists).toBe(true);

    console.log(`✅ Successfully uploaded WAV file ${result.fileId}: ${testFile.name}`);
  });

  test('should upload file with location data', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.contentType,
          buffer: testFile.buffer,
        },
        latitude: '37.7749',
        longitude: '-122.4194',
        locationAccuracy: '10',
        locationProvider: 'gps'
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    expect(responseData.success).toBe(true);
    expect(responseData.data.locationCaptured).toBe(true);
    
    const result = responseData.data.results[0];
    uploadedFileIds.push(result.fileId);

    // Verify location was stored
    const fileResponse = await request.get(`/api/files/${result.fileId}`);
    const fileData = await fileResponse.json();
    uploadedPaths.push(fileData.data.fileName);

    expect(fileData.data.latitude).toBeCloseTo(37.7749, 4);
    expect(fileData.data.longitude).toBeCloseTo(-122.4194, 3);

    console.log(`✅ Successfully uploaded file with location data: ${result.fileId}`);
  });

  test('should upload file with speaker count', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.contentType,
          buffer: testFile.buffer,
        },
        speakerCount: '3'
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    expect(responseData.success).toBe(true);
    expect(responseData.data.speakerCount).toBe(3);
    expect(responseData.data.speakerDetection).toBe('user_specified');
    
    const result = responseData.data.results[0];
    uploadedFileIds.push(result.fileId);

    // Get file path for cleanup
    const fileResponse = await request.get(`/api/files/${result.fileId}`);
    const fileData = await fileResponse.json();
    uploadedPaths.push(fileData.data.fileName);

    console.log(`✅ Successfully uploaded file with speaker count: ${result.fileId}`);
  });

  test('should handle single file upload (multiple files not supported in Playwright multipart)', async ({ request }) => {
    const testFiles = [
      TestHelpers.getTestFile('test-audio-small.mp3'),
      TestHelpers.getTestFile('test-voice-message.ogg'),
    ];
    
    // Note: Playwright multipart doesn't support multiple files with same field name
    // Upload only one file and adjust expectations
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFiles[0].name,
          mimeType: testFiles[0].contentType,
          buffer: testFiles[0].buffer,
        }
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    expect(responseData.success).toBe(true);
    expect(responseData.data.totalFiles).toBe(1);
    expect(responseData.data.successCount).toBe(1);
    expect(responseData.data.failureCount).toBe(0);
    expect(responseData.data.results).toHaveLength(1);

    // Track both files for cleanup
    for (const result of responseData.data.results) {
      expect(result.success).toBe(true);
      uploadedFileIds.push(result.fileId);

      // Get file path for cleanup
      const fileResponse = await request.get(`/api/files/${result.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.data.fileName);
    }

    console.log(`✅ Successfully uploaded ${responseData.data.successCount} files`);
  });

  test('should reject invalid file type', async ({ request }) => {
    const invalidFile = TestHelpers.getTestFile('invalid-file.txt');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: invalidFile.name,
          mimeType: 'text/plain',
          buffer: invalidFile.buffer,
        }
      },
    });

    expect(response.status()).toBe(400); // Should return 400 for invalid file type
    const responseData = await response.json();

    expect(responseData.success).toBe(false);
    expect(responseData.error).toBeDefined();
    expect(responseData.error.message).toContain('Invalid file type');

    console.log(`✅ Successfully rejected invalid file type: ${invalidFile.name}`);
  });

  test('should handle empty file upload request', async ({ request }) => {
    const response = await request.post('/api/upload', {
      multipart: {}
    });

    expect(response.status()).toBe(400);
    const responseData = await response.json();

    expect(responseData.success).toBe(false);
    expect(responseData.error.code).toBe('NO_FILES');
    expect(responseData.error.message).toContain('No files provided');

    console.log(`✅ Successfully handled empty upload request`);
  });

  test('should validate speaker count parameter', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.contentType,
          buffer: testFile.buffer,
        },
        speakerCount: 'invalid'
      },
    });

    expect(response.status()).toBe(400);
    const responseData = await response.json();

    expect(responseData.success).toBe(false);
    expect(responseData.error.code).toBe('INVALID_SPEAKER_COUNT');

    console.log(`✅ Successfully validated speaker count parameter`);
  });

  test('should verify file content integrity after upload', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.contentType,
          buffer: testFile.buffer,
        }
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();
    const result = responseData.data.results[0];
    
    uploadedFileIds.push(result.fileId);

    // Get file details
    const fileResponse = await request.get(`/api/files/${result.fileId}`);
    const fileData = await fileResponse.json();
    uploadedPaths.push(fileData.data.fileName);

    // Download file from Supabase and verify content
    const downloadedContent = await supabaseManager.downloadFile('audio-files', fileData.data.fileName);
    expect(downloadedContent.equals(testFile.buffer)).toBe(true);

    console.log(`✅ Successfully verified file content integrity: ${result.fileId}`);
  });
});