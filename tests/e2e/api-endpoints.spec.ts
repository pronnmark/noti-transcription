import { test, expect, APIRequestContext } from '@playwright/test';
import { TestHelpers, TestFile } from '../utils/test-helpers';

test.describe('API Endpoints with Supabase Integration', () => {
  let testFiles: TestFile[] = [];
  let uploadedFileIds: number[] = [];
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

  test.describe('POST /api/upload', () => {
    test('should upload file to Supabase and create database record', async ({ request }) => {
      const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
      
      // Upload file via API
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      
      // Verify response structure
      expect(uploadResponse.fileId).toBeDefined();
      expect(uploadResponse.message).toContain('uploaded successfully');
      expect(uploadResponse.transcriptionStarted).toBe(true);
      expect(uploadResponse.isDraft).toBe(false);
      
      uploadedFileIds.push(uploadResponse.fileId);

      // Verify file was stored in Supabase by checking database record
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      expect(fileResponse.ok()).toBeTruthy();
      
      const fileData = await fileResponse.json();
      expect(fileData.fileName).toMatch(/^uploads\/\\d{4}-\\d{2}-\\d{2}\//); // Supabase path pattern
      expect(fileData.originalFileName).toBe(testFile.name);
      expect(fileData.fileSize).toBe(testFile.size);
      
      uploadedPaths.push(fileData.fileName);
    });

    test('should handle draft uploads correctly', async ({ request }) => {
      const testFile = TestHelpers.getTestFile('test-audio-medium.wav');
      
      // Upload as draft
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile, { isDraft: true });
      
      expect(uploadResponse.fileId).toBeDefined();
      expect(uploadResponse.message).toContain('Draft recording saved');
      expect(uploadResponse.transcriptionStarted).toBe(false);
      expect(uploadResponse.isDraft).toBe(true);
      
      uploadedFileIds.push(uploadResponse.fileId);

      // Get file details
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    });

    test('should handle different audio formats', async ({ request }) => {
      const formats = ['test-audio-small.mp3', 'test-audio-medium.wav', 'test-voice-message.ogg'];
      
      for (const format of formats) {
        const testFile = TestHelpers.getTestFile(format);
        const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
        
        expect(uploadResponse.fileId).toBeDefined();
        uploadedFileIds.push(uploadResponse.fileId);

        const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
        const fileData = await fileResponse.json();
        uploadedPaths.push(fileData.fileName);
      }
    });

    test('should reject invalid file types', async ({ request }) => {
      const invalidFile = TestHelpers.getTestFile('invalid-file.txt');
      
      const formData = new FormData();
      const blob = new Blob([invalidFile.buffer], { type: 'text/plain' });
      formData.append('file', blob, invalidFile.name);

      const response = await request.post('/api/upload', {
        multipart: formData,
      });

      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('Invalid file type');
    });

    test('should handle speaker count option', async ({ request }) => {
      const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
      
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile, { 
        speakerCount: 3 
      });
      
      expect(uploadResponse.fileId).toBeDefined();
      uploadedFileIds.push(uploadResponse.fileId);

      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);
    });
  });

  test.describe('GET /api/files/[id]', () => {
    test('should retrieve file metadata for Supabase-stored files', async ({ request }) => {
      // First upload a file
      const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      uploadedFileIds.push(uploadResponse.fileId);

      // Retrieve file metadata
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      expect(fileResponse.ok()).toBeTruthy();
      
      const fileData = await fileResponse.json();
      
      // Verify metadata structure
      expect(fileData.id).toBe(uploadResponse.fileId);
      expect(fileData.fileName).toMatch(/^uploads\/\\d{4}-\\d{2}-\\d{2}\//); // Supabase path
      expect(fileData.originalFileName).toBe(testFile.name);
      expect(fileData.originalFileType).toBe(testFile.contentType);
      expect(fileData.fileSize).toBe(testFile.size);
      expect(fileData.uploadedAt).toBeDefined();
      
      uploadedPaths.push(fileData.fileName);
    });

    test('should return 404 for non-existent files', async ({ request }) => {
      const response = await request.get('/api/files/99999');
      expect(response.status()).toBe(404);
    });
  });

  test.describe('GET /api/files (list files)', () => {
    test('should list files with Supabase storage paths', async ({ request }) => {
      // Upload a couple of files first
      const testFile1 = TestHelpers.getTestFile('test-audio-small.mp3');
      const testFile2 = TestHelpers.getTestFile('test-audio-medium.wav');
      
      const upload1 = await TestHelpers.uploadFileViaAPI(request, testFile1);
      const upload2 = await TestHelpers.uploadFileViaAPI(request, testFile2);
      
      uploadedFileIds.push(upload1.fileId, upload2.fileId);

      // List files
      const listResponse = await request.get('/api/files');
      expect(listResponse.ok()).toBeTruthy();
      
      const filesData = await listResponse.json();
      expect(Array.isArray(filesData.data)).toBeTruthy();
      expect(filesData.data.length).toBeGreaterThanOrEqual(2);
      
      // Find our uploaded files
      const ourFiles = filesData.data.filter((file: any) => 
        [upload1.fileId, upload2.fileId].includes(file.id)
      );
      
      expect(ourFiles).toHaveLength(2);
      
      // Verify all files have Supabase storage paths
      ourFiles.forEach((file: any) => {
        expect(file.fileName).toMatch(/^uploads\/\\d{4}-\\d{2}-\\d{2}\//);
        uploadedPaths.push(file.fileName);
      });
    });
  });

  test.describe('POST /api/transcribe-simple/[id]', () => {
    test('should download file from Supabase for transcription', async ({ request }) => {
      // Upload a file first
      const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      uploadedFileIds.push(uploadResponse.fileId);

      // Get file data to track path
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);

      // Trigger transcription
      const transcribeResponse = await request.post(`/api/transcribe-simple/${uploadResponse.fileId}`);
      expect(transcribeResponse.ok()).toBeTruthy();
      
      const transcribeData = await transcribeResponse.json();
      expect(transcribeData.success).toBe(true);
      expect(transcribeData.jobId).toBeDefined();
      expect(transcribeData.message).toContain('Transcription started');
      
      // The fact that this succeeds means the file was successfully downloaded from Supabase
      // for processing (the implementation downloads to temp location for Whisper)
    });

    test('should handle non-existent file gracefully', async ({ request }) => {
      const response = await request.post('/api/transcribe-simple/99999');
      expect(response.status()).toBe(404);
      
      const errorData = await response.json();
      expect(errorData.error).toContain('File not found');
    });
  });

  test.describe('GET /api/transcribe/status/[id]', () => {
    test('should return transcription status for uploaded files', async ({ request }) => {
      // Upload a file
      const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      uploadedFileIds.push(uploadResponse.fileId);

      // Get file data
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);

      // Check transcription status
      const statusResponse = await request.get(`/api/transcribe/status/${uploadResponse.fileId}`);
      expect(statusResponse.ok()).toBeTruthy();
      
      const statusData = await statusResponse.json();
      expect(statusData.exists).toBe(true);
      expect(statusData.job).toBeDefined();
      expect(['pending', 'processing', 'completed', 'failed']).toContain(statusData.job.status);
    });
  });

  test.describe('File integrity verification', () => {
    test('should maintain file integrity through upload-download cycle', async ({ request }) => {
      const testFile = TestHelpers.getTestFile('test-audio-medium.wav');
      
      // Upload file
      const uploadResponse = await TestHelpers.uploadFileViaAPI(request, testFile);
      uploadedFileIds.push(uploadResponse.fileId);

      // Get file metadata
      const fileResponse = await request.get(`/api/files/${uploadResponse.fileId}`);
      const fileData = await fileResponse.json();
      uploadedPaths.push(fileData.fileName);

      // Verify the file is actually stored in Supabase with correct content
      await TestHelpers.verifyFileInSupabase(
        'test-audio-files',
        fileData.fileName,
        testFile.buffer
      );
    });
  });
});