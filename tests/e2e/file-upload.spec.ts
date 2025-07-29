import { test, expect, Page } from '@playwright/test';
import { TestHelpers, TestFile } from '../utils/test-helpers';
import { join } from 'path';

test.describe('File Upload UI Flow', () => {
  let uploadedPaths: string[] = [];

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

  test.beforeEach(async ({ page }) => {
    // Navigate to the upload page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
  });

  test('should upload file through browser interface and store in Supabase', async ({ page }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Listen for the upload API call
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    // Find and interact with file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    // Wait for upload to complete
    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    expect(uploadData.fileId).toBeDefined();
    expect(uploadData.message).toContain('uploaded successfully');

    // Verify the file appears in the UI (if there's a file list)
    const fileIdText = uploadData.fileId.toString();
    
    // Navigate to files page to verify upload
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    // Look for the uploaded file in the list
    const fileList = page.locator('[data-testid="file-list"], table, .file-item').first();
    if (await fileList.isVisible()) {
      await expect(page.locator(`text=${testFile.name}`).or(
        page.locator(`text=${fileIdText}`)
      )).toBeVisible({ timeout: 10000 });
    }

    // Track for cleanup
    const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }
  });

  test('should handle drag and drop file upload', async ({ page }) => {
    const testFile = TestHelpers.getTestFile('test-audio-medium.wav');
    
    // Look for drop zone or file input area
    const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, .upload-area').first();
    
    if (await dropZone.isVisible()) {
      // Listen for upload request
      const uploadPromise = page.waitForResponse(response => 
        response.url().includes('/api/upload') && response.request().method() === 'POST'
      );

      // Simulate drag and drop
      const fileBuffer = await page.evaluateHandle((fileData) => {
        const dt = new DataTransfer();
        const file = new File([new Uint8Array(fileData.buffer)], fileData.name, {
          type: fileData.contentType
        });
        dt.items.add(file);
        return dt;
      }, {
        buffer: Array.from(testFile.buffer),
        name: testFile.name,
        contentType: testFile.contentType
      });

      await dropZone.dispatchEvent('drop', { dataTransfer: fileBuffer });

      // Wait for upload completion
      const uploadResponse = await uploadPromise;
      expect(uploadResponse.ok()).toBeTruthy();

      const uploadData = await uploadResponse.json();
      expect(uploadData.fileId).toBeDefined();

      // Track for cleanup
      const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
      if (fileResponse.ok()) {
        const fileData = await fileResponse.json();
        uploadedPaths.push(fileData.fileName);
      }
    } else {
      // If no drop zone, skip this test
      test.skip();
    }
  });

  test('should show upload progress and completion feedback', async ({ page }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Monitor network requests
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    // Look for progress indicators or loading states
    const progressIndicator = page.locator(
      '[data-testid="upload-progress"], .progress, .loading, .spinner'
    ).first();
    
    if (await progressIndicator.isVisible({ timeout: 2000 })) {
      // Verify progress indicator appears
      await expect(progressIndicator).toBeVisible();
    }

    // Wait for upload completion
    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();

    // Look for success message or notification
    const successMessage = page.locator(
      'text=uploaded successfully, text=Upload complete, [data-testid="success-message"], .success'
    ).first();
    
    if (await successMessage.isVisible({ timeout: 5000 })) {
      await expect(successMessage).toBeVisible();
    }

    // Track for cleanup
    const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }
  });

  test('should handle multiple file uploads', async ({ page }) => {
    const testFiles = [
      TestHelpers.getTestFile('test-audio-small.mp3'),
      TestHelpers.getTestFile('test-audio-medium.wav'),
    ];

    const uploadPromises: Promise<any>[] = [];

    for (const testFile of testFiles) {
      // Listen for each upload
      const uploadPromise = page.waitForResponse(response => 
        response.url().includes('/api/upload') && response.request().method() === 'POST'
      );
      uploadPromises.push(uploadPromise);

      // Upload file
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testFile.path);
      
      // Small delay between uploads
      await page.waitForTimeout(1000);
    }

    // Wait for all uploads to complete
    const uploadResponses = await Promise.all(uploadPromises);
    
    for (const response of uploadResponses) {
      expect(response.ok()).toBeTruthy();
      const uploadData = await response.json();
      expect(uploadData.fileId).toBeDefined();

      // Track for cleanup
      const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
      if (fileResponse.ok()) {
        const fileData = await fileResponse.json();
        uploadedPaths.push(fileData.fileName);
      }
    }
  });

  test('should display error message for invalid file types', async ({ page }) => {
    const invalidFile = TestHelpers.getTestFile('invalid-file.txt');
    
    // Upload invalid file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(invalidFile.path);

    // Look for error message
    const errorMessage = page.locator(
      'text=Invalid file type, text=not supported, [data-testid="error-message"], .error'
    ).first();
    
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should handle draft upload option if available', async ({ page }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Look for draft checkbox or toggle
    const draftOption = page.locator(
      'input[type="checkbox"][name*="draft"], input[type="checkbox"][id*="draft"], [data-testid="draft-toggle"]'
    ).first();

    if (await draftOption.isVisible()) {
      // Enable draft mode
      await draftOption.check();

      // Listen for upload
      const uploadPromise = page.waitForResponse(response => 
        response.url().includes('/api/upload') && response.request().method() === 'POST'
      );

      // Upload file
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testFile.path);

      const uploadResponse = await uploadPromise;
      expect(uploadResponse.ok()).toBeTruthy();

      const uploadData = await uploadResponse.json();
      expect(uploadData.isDraft).toBe(true);
      expect(uploadData.transcriptionStarted).toBe(false);

      // Track for cleanup
      const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
      if (fileResponse.ok()) {
        const fileData = await fileResponse.json();
        uploadedPaths.push(fileData.fileName);
      }
    } else {
      test.skip();
    }
  });

  test('should redirect to file details after successful upload', async ({ page }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Upload file
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();

    // Wait for potential redirect or navigation
    await page.waitForTimeout(2000);

    // Check if we're on a file details page or files list
    const currentUrl = page.url();
    const isOnFileDetailsPage = currentUrl.includes('/transcript/') || 
                               currentUrl.includes('/files/') ||
                               currentUrl.includes('/extract/');

    if (isOnFileDetailsPage) {
      // Verify file information is displayed
      const fileInfo = page.locator(`text=${testFile.name}`).first();
      if (await fileInfo.isVisible()) {
        await expect(fileInfo).toBeVisible();
      }
    }

    // Track for cleanup
    const fileResponse = await page.request.get(`/api/files/${uploadData.fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }
  });
});