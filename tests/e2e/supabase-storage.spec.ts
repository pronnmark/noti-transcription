import { test, expect } from '@playwright/test';
import { TestHelpers, TestFile } from '../utils/test-helpers';
import { SupabaseStorageService } from '../../src/lib/services/core/SupabaseStorageService';

test.describe('Supabase Storage Integration', () => {
  let storageService: SupabaseStorageService;
  let testFiles: TestFile[] = [];
  let uploadedPaths: string[] = [];

  test.beforeAll(async () => {
    // Initialize storage service with test environment
    (process.env as any).NODE_ENV = 'test';
    process.env.SUPABASE_URL =
      process.env.TEST_SUPABASE_URL || 'http://127.0.0.1:54321';
    process.env.SUPABASE_ANON_KEY =
      process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key';

    storageService = new SupabaseStorageService();
    await storageService.initialize();
  });

  test.afterAll(async () => {
    // Cleanup uploaded test files
    if (uploadedPaths.length > 0) {
      try {
        await TestHelpers.cleanupTestFiles('test-audio-files', uploadedPaths);
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
  });

  test('should upload and retrieve file maintaining binary integrity', async () => {
    // Get test file
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const uniquePath = `e2e-test/${TestHelpers.generateUniqueFileName(testFile.name)}`;

    // Upload file to Supabase
    const uploadResult = await storageService.uploadFile({
      bucket: 'test-audio-files',
      path: uniquePath,
      file: testFile.buffer,
      contentType: testFile.contentType,
      cacheControl: '3600',
    });

    uploadedPaths.push(uploadResult.path);

    // Verify upload result
    expect(uploadResult.path).toBe(uniquePath);
    expect(uploadResult.fullPath).toContain(uniquePath);

    // Verify file exists
    const fileExists = await storageService.fileExists(
      'test-audio-files',
      uniquePath
    );
    expect(fileExists).toBeTruthy();

    // Download file and verify content integrity
    const downloadedBuffer = await storageService.downloadFile(
      'test-audio-files',
      uniquePath
    );
    expect(downloadedBuffer.equals(testFile.buffer)).toBeTruthy();
    expect(downloadedBuffer.length).toBe(testFile.size);
  });

  test('should handle different audio file formats', async () => {
    const testFormats = [
      'test-audio-small.mp3',
      'test-audio-medium.wav',
      'test-voice-message.ogg',
    ];

    for (const format of testFormats) {
      const testFile = TestHelpers.getTestFile(format);
      const uniquePath = `e2e-test/${TestHelpers.generateUniqueFileName(testFile.name)}`;

      // Upload
      const uploadResult = await storageService.uploadFile({
        bucket: 'test-audio-files',
        path: uniquePath,
        file: testFile.buffer,
        contentType: testFile.contentType,
      });

      uploadedPaths.push(uploadResult.path);

      // Verify
      const downloadedBuffer = await storageService.downloadFile(
        'test-audio-files',
        uniquePath
      );
      expect(downloadedBuffer.equals(testFile.buffer)).toBeTruthy();
    }
  });

  test('should generate signed URLs for private files', async () => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const uniquePath = `e2e-test/${TestHelpers.generateUniqueFileName(testFile.name)}`;

    // Upload file
    await storageService.uploadFile({
      bucket: 'test-audio-files',
      path: uniquePath,
      file: testFile.buffer,
      contentType: testFile.contentType,
    });

    uploadedPaths.push(uniquePath);

    // Generate signed URL
    const signedUrl = await storageService.getFileUrl(
      'test-audio-files',
      uniquePath,
      3600
    );

    expect(signedUrl).toBeTruthy();
    expect(signedUrl).toContain('http');
    expect(signedUrl).toContain('sign');
  });

  test('should handle file deletion correctly', async () => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const uniquePath = `e2e-test/${TestHelpers.generateUniqueFileName(testFile.name)}`;

    // Upload file
    await storageService.uploadFile({
      bucket: 'test-audio-files',
      path: uniquePath,
      file: testFile.buffer,
      contentType: testFile.contentType,
    });

    // Verify file exists
    let fileExists = await storageService.fileExists(
      'test-audio-files',
      uniquePath
    );
    expect(fileExists).toBeTruthy();

    // Delete file
    await storageService.deleteFiles({
      bucket: 'test-audio-files',
      paths: [uniquePath],
    });

    // Verify file no longer exists
    fileExists = await storageService.fileExists(
      'test-audio-files',
      uniquePath
    );
    expect(fileExists).toBeFalsy();
  });

  test('should handle upload errors gracefully', async () => {
    // Test with invalid bucket name
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');

    await expect(
      storageService.uploadFile({
        bucket: 'non-existent-bucket',
        path: 'test.mp3',
        file: testFile.buffer,
        contentType: testFile.contentType,
      })
    ).rejects.toThrow();
  });

  test('should handle download errors gracefully', async () => {
    // Test downloading non-existent file
    await expect(
      storageService.downloadFile('test-audio-files', 'non-existent-file.mp3')
    ).rejects.toThrow();
  });

  test('should handle file info retrieval', async () => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const uniquePath = `e2e-test/${TestHelpers.generateUniqueFileName(testFile.name)}`;

    // Upload file
    await storageService.uploadFile({
      bucket: 'test-audio-files',
      path: uniquePath,
      file: testFile.buffer,
      contentType: testFile.contentType,
    });

    uploadedPaths.push(uniquePath);

    // Get file info
    const fileInfo = await storageService.getFileInfo(
      'test-audio-files',
      uniquePath
    );

    expect(fileInfo).toBeTruthy();
    expect(fileInfo.name).toBe(uniquePath.split('/').pop());
    expect(fileInfo.metadata).toBeDefined();
  });

  test('should handle concurrent uploads without conflicts', async () => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    const uploadPromises: Promise<any>[] = [];
    const paths: string[] = [];

    // Create 5 concurrent uploads with unique paths
    for (let i = 0; i < 5; i++) {
      const uniquePath = `e2e-test/concurrent_${i}_${TestHelpers.generateUniqueFileName(testFile.name)}`;
      paths.push(uniquePath);

      const uploadPromise = storageService.uploadFile({
        bucket: 'test-audio-files',
        path: uniquePath,
        file: testFile.buffer,
        contentType: testFile.contentType,
      });

      uploadPromises.push(uploadPromise);
    }

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    uploadedPaths.push(...paths);

    // Verify all uploads succeeded
    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.path).toBe(paths[index]);
    });

    // Verify all files exist
    for (const path of paths) {
      const exists = await storageService.fileExists('test-audio-files', path);
      expect(exists).toBeTruthy();
    }
  });
});
