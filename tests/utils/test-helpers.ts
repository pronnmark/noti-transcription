import { APIRequestContext, expect } from '@playwright/test';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { SupabaseTestManager } from './supabase-test-manager';

export interface TestFile {
  name: string;
  path: string;
  buffer: Buffer;
  contentType: string;
  size: number;
}

export class TestHelpers {
  private static supabaseManager: SupabaseTestManager;

  static async setupTestEnvironment(): Promise<void> {
    // Initialize Supabase test manager
    this.supabaseManager = new SupabaseTestManager();
    await this.supabaseManager.setup();

    // Clean up any existing test database (commented out to preserve pre-created DB)
    // const testDbPath = './test-e2e.db';
    // if (existsSync(testDbPath)) {
    //   unlinkSync(testDbPath);
    // }

    // TODO: Add database migration setup - currently run manually
    console.log('📊 Using pre-configured test database (migrations should be run manually)');
  }

  static async cleanupTestEnvironment(): Promise<void> {
    if (this.supabaseManager) {
      await this.supabaseManager.cleanup();
    }

    // Clean up test database
    const testDbPath = './test-e2e.db';
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  }

  static getTestFile(fileName: string): TestFile {
    const testFilePath = join(__dirname, '..', 'fixtures', fileName);
    if (!existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }

    const buffer = readFileSync(testFilePath);
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const contentTypeMap: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
    };

    return {
      name: fileName,
      path: testFilePath,
      buffer,
      contentType: contentTypeMap[extension || ''] || 'audio/mpeg',
      size: buffer.length,
    };
  }

  static async uploadFileViaAPI(
    request: APIRequestContext,
    file: TestFile,
    options: { isDraft?: boolean; speakerCount?: number } = {}
  ): Promise<any> {
    // Use Playwright's multipart format instead of FormData
    const multipartData: any = {
      file: {
        name: file.name,
        mimeType: file.contentType,
        buffer: file.buffer,
      }
    };
    
    if (options.isDraft) {
      multipartData.isDraft = 'true';
    }
    if (options.speakerCount) {
      multipartData.speakerCount = options.speakerCount.toString();
    }

    const response = await request.post('/api/upload', {
      multipart: multipartData,
    });

    if (!response.ok()) {
      const errorText = await response.text();
      console.error('Upload failed:', {
        status: response.status(),
        statusText: response.statusText(),
        body: errorText
      });
    }

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();
    
    // Return the first result for backward compatibility
    if (responseData.data?.results?.length > 0) {
      return responseData.data.results[0];
    }
    
    // Fallback if response structure is different
    return responseData;
  }

  static async waitForTranscription(
    request: APIRequestContext,
    fileId: number,
    timeoutMs: number = 30000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const response = await request.get(`/api/transcribe/status/${fileId}`);
      expect(response.ok()).toBeTruthy();
      
      const status = await response.json();
      
      if (status.job?.status === 'completed') {
        return status.job;
      }
      
      if (status.job?.status === 'failed') {
        throw new Error(`Transcription failed: ${status.job.lastError}`);
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Transcription timed out after ${timeoutMs}ms`);
  }

  static async verifyFileInSupabase(
    bucket: string,
    path: string,
    expectedContent: Buffer
  ): Promise<void> {
    if (!this.supabaseManager) {
      throw new Error('Supabase test manager not initialized');
    }

    const fileExists = await this.supabaseManager.fileExists(bucket, path);
    expect(fileExists).toBeTruthy();

    const downloadedContent = await this.supabaseManager.downloadFile(bucket, path);
    expect(downloadedContent.equals(expectedContent)).toBeTruthy();
  }

  static generateUniqueFileName(baseName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = baseName.split('.').pop();
    const nameWithoutExt = baseName.replace(`.${extension}`, '');
    
    return `test_${nameWithoutExt}_${timestamp}_${random}.${extension}`;
  }

  static async cleanupTestFiles(bucket: string, paths: string[]): Promise<void> {
    if (!this.supabaseManager || paths.length === 0) {
      return;
    }

    try {
      await this.supabaseManager.deleteFiles(bucket, paths);
    } catch (error) {
      console.warn('Failed to cleanup test files:', error);
    }
  }
}

// Export convenience functions
export const setupTestEnvironment = TestHelpers.setupTestEnvironment.bind(TestHelpers);
export const cleanupTestEnvironment = TestHelpers.cleanupTestEnvironment.bind(TestHelpers);