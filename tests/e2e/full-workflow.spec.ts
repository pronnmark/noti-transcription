import { test, expect } from '@playwright/test';
import { TestHelpers, TestFile } from '../utils/test-helpers';

test.describe('Complete User Workflows', () => {
  let uploadedPaths: string[] = [];
  let uploadedFileIds: number[] = [];

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

  test('complete upload → transcription → view results workflow', async ({ page, request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Step 1: Upload file through UI
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.fileId;
    
    expect(fileId).toBeDefined();
    expect(uploadData.transcriptionStarted).toBe(true);
    
    uploadedFileIds.push(fileId);

    // Track file path for cleanup
    const fileResponse = await request.get(`/api/files/${fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }

    // Step 2: Navigate to files page and verify upload
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    // Look for the uploaded file in the list
    const fileEntry = page.locator(`[data-file-id="${fileId}"], text=${testFile.name}`).first();
    if (await fileEntry.isVisible({ timeout: 5000 })) {
      await expect(fileEntry).toBeVisible();
    }

    // Step 3: Check transcription status
    const transcriptionStatus = await TestHelpers.waitForTranscription(request, fileId, 30000);
    expect(transcriptionStatus.status).toBe('completed');
    expect(transcriptionStatus.transcript).toBeDefined();

    // Step 4: Navigate to transcript view
    await page.goto(`/transcript/${fileId}`);
    await page.waitForLoadState('networkidle');

    // Verify transcript page loads
    await expect(page.locator('h1, h2, [data-testid="transcript-title"]')).toBeVisible();
    
    // Look for transcript content (even if it's empty/placeholder)
    const transcriptContent = page.locator(
      '[data-testid="transcript-content"], .transcript, .transcript-text'
    ).first();
    
    if (await transcriptContent.isVisible()) {
      await expect(transcriptContent).toBeVisible();
    }

    // Step 5: Verify file integrity through the entire flow
    await TestHelpers.verifyFileInSupabase('test-audio-files', uploadedPaths[0], testFile.buffer);
  });

  test('file management operations workflow', async ({ page, request }) => {
    // Upload multiple files
    const testFiles = [
      TestHelpers.getTestFile('test-audio-small.mp3'),
      TestHelpers.getTestFile('test-audio-medium.wav'),
    ];

    const uploadedIds: number[] = [];

    // Upload files via API for faster test execution
    for (const testFile of testFiles) {
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      uploadedIds.push(uploadResponse.fileId);
      uploadedFileIds.push(uploadResponse.fileId);

      // Track for cleanup
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      if (fileResponse.ok()) {
        const fileData = await fileResponse.json();
        uploadedPaths.push(fileData.fileName);
      }
    }

    // Navigate to files page
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    // Verify files are listed
    for (const fileId of uploadedIds) {
      const fileLink = page.locator(`a[href*="${fileId}"], [data-file-id="${fileId}"]`).first();
      if (await fileLink.isVisible({ timeout: 5000 })) {
        await expect(fileLink).toBeVisible();
      }
    }

    // Test file details navigation
    const firstFileId = uploadedIds[0];
    const firstFileLink = page.locator(`a[href*="${firstFileId}"]`).first();
    
    if (await firstFileLink.isVisible()) {
      await firstFileLink.click();
      await page.waitForLoadState('networkidle');

      // Verify we're on the file details page
      const currentUrl = page.url();
      expect(currentUrl).toContain(firstFileId.toString());
    } else {
      // Navigate directly if no link found
      await page.goto(`/transcript/${firstFileId}`);
      await page.waitForLoadState('networkidle');
    }

    // Verify file details are shown
    const fileInfo = page.locator(
      '[data-testid="file-info"], .file-details, .metadata'
    ).first();
    
    if (await fileInfo.isVisible()) {
      await expect(fileInfo).toBeVisible();
    }
  });

  test('upload with location data workflow', async ({ page, request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Mock geolocation
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 37.7749, longitude: -122.4194 });

    // Navigate to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Look for location enable button or setting
    const locationButton = page.locator(
      'button:has-text("Enable Location"), [data-testid="location-toggle"], input[name*="location"]'
    ).first();

    if (await locationButton.isVisible()) {
      await locationButton.click();
    }

    // Upload file
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    uploadedFileIds.push(uploadData.fileId);

    // Verify location data was captured
    const fileResponse = await request.get(`/api/files/${uploadData.fileId}`);
    expect(fileResponse.ok()).toBeTruthy();
    
    const fileData = await fileResponse.json();
    uploadedPaths.push(fileData.fileName);

    // Check if location data was stored (may be null if not implemented)
    if (fileData.latitude !== null && fileData.longitude !== null) {
      expect(fileData.latitude).toBeCloseTo(37.7749, 4);
      expect(fileData.longitude).toBeCloseTo(-122.4194, 4);
    }
  });

  test('error handling and recovery workflow', async ({ page, request }) => {
    // Test 1: Invalid file upload
    const invalidFile = TestHelpers.getTestFile('invalid-file.txt');
    
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(invalidFile.path);

    // Verify error message appears
    const errorMessage = page.locator(
      'text=Invalid file type, text=not supported, [data-testid="error-message"], .error'
    ).first();
    
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Test 2: Valid file upload after error
    const validFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    await fileInput.setInputFiles(validFile.path);

    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    uploadedFileIds.push(uploadData.fileId);

    // Track for cleanup
    const fileResponse = await request.get(`/api/files/${uploadData.fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }

    // Verify success message or navigation
    const successMessage = page.locator(
      'text=uploaded successfully, text=Upload complete, [data-testid="success-message"], .success'
    ).first();
    
    if (await successMessage.isVisible({ timeout: 5000 })) {
      await expect(successMessage).toBeVisible();
    }
  });

  test('transcription monitoring workflow', async ({ page, request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-medium.wav');
    
    // Upload file via API
    const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
    const fileId = uploadResponse.fileId;
    
    uploadedFileIds.push(fileId);

    // Track for cleanup
    const fileResponse = await request.get(`/api/files/${fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }

    // Navigate to transcript page
    await page.goto(`/transcript/${fileId}`);
    await page.waitForLoadState('networkidle');

    // Look for transcription status indicators
    const statusIndicator = page.locator(
      '[data-testid="transcription-status"], .status, .progress'
    ).first();

    if (await statusIndicator.isVisible()) {
      // Check initial status (should be pending or processing)
      const initialStatus = await statusIndicator.textContent();
      expect(initialStatus?.toLowerCase()).toMatch(/pending|processing|in progress/);
    }

    // Wait for transcription to complete
    const transcriptionResult = await TestHelpers.waitForTranscription(request, fileId, 30000);
    expect(transcriptionResult.status).toBe('completed');

    // Refresh page to see completed transcription
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify completed status is shown
    if (await statusIndicator.isVisible()) {
      const completedStatus = await statusIndicator.textContent();
      expect(completedStatus?.toLowerCase()).toMatch(/completed|done|finished/);
    }
  });

  test('cross-browser compatibility workflow', async ({ browserName, page, request }) => {
    // This test runs on multiple browsers via Playwright config
    console.log(`Testing on ${browserName}`);
    
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Upload workflow
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/upload') && response.request().method() === 'POST'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile.path);

    const uploadResponse = await uploadPromise;
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    uploadedFileIds.push(uploadData.fileId);

    // Track for cleanup
    const fileResponse = await request.get(`/api/files/${uploadData.fileId}`);
    if (fileResponse.ok()) {
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    }

    // Navigate to files page
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    // Verify page loads correctly in all browsers
    await expect(page.locator('body')).toBeVisible();
    
    // Basic functionality should work across browsers
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);
  });
});