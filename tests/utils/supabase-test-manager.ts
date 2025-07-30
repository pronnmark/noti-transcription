import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseTestManager {
  private client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private createdBuckets: string[] = [];
  private uploadedFiles: Array<{ bucket: string; path: string }> = [];

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    this.supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    console.log(
      `🔧 SupabaseTestManager initializing with URL: ${this.supabaseUrl}`
    );
    console.log(`🔑 Key present: ${this.supabaseKey ? 'YES' : 'NO'}`);

    if (!this.supabaseKey) {
      throw new Error(
        'Supabase key is required for testing. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY'
      );
    }

    try {
      this.client = createClient(this.supabaseUrl, this.supabaseKey);
      console.log('✅ Supabase client created successfully');
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error);
      throw error;
    }
  }

  async setup(): Promise<void> {
    try {
      // Ensure test buckets exist
      await this.ensureTestBucketsExist();
      console.log('✅ Supabase test buckets ready');
    } catch (error) {
      console.error('❌ Failed to setup Supabase test environment:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up uploaded files
      await this.cleanupUploadedFiles();

      // Clean up created buckets (optional - you might want to keep them for next run)
      // await this.cleanupCreatedBuckets();

      console.log('✅ Supabase test cleanup complete');
    } catch (error) {
      console.error('❌ Supabase test cleanup failed:', error);
    }
  }

  private async ensureTestBucketsExist(): Promise<void> {
    const testBuckets = [
      { name: 'test-audio-files', public: false },
      { name: 'test-transcripts', public: false },
    ];

    for (const bucket of testBuckets) {
      try {
        // Check if bucket exists
        const { data: existingBucket, error: listError } =
          await this.client.storage.getBucket(bucket.name);

        if (listError && listError.message.includes('not found')) {
          // Create bucket if it doesn't exist
          const { error: createError } = await this.client.storage.createBucket(
            bucket.name,
            {
              public: bucket.public,
              allowedMimeTypes: bucket.name.includes('audio')
                ? ['audio/*', 'video/*']
                : ['application/json', 'text/*'],
              fileSizeLimit: 100 * 1024 * 1024, // 100MB
            }
          );

          if (createError) {
            throw new Error(
              `Failed to create test bucket ${bucket.name}: ${createError.message}`
            );
          }

          this.createdBuckets.push(bucket.name);
          console.log(`✅ Created test bucket: ${bucket.name}`);
        } else if (listError) {
          throw new Error(
            `Failed to check test bucket ${bucket.name}: ${listError.message}`
          );
        }
      } catch (error) {
        console.error(`Error setting up test bucket ${bucket.name}:`, error);
        throw error;
      }
    }
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string = 'audio/mpeg'
  ): Promise<{ path: string; publicUrl?: string }> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw new Error(`Supabase test upload failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Upload succeeded but no data returned');
      }

      // Track uploaded file for cleanup
      this.uploadedFiles.push({ bucket, path: data.path });

      // Get public URL if available
      let publicUrl: string | undefined;
      try {
        const { data: urlData } = this.client.storage
          .from(bucket)
          .getPublicUrl(path);
        publicUrl = urlData.publicUrl;
      } catch (urlError) {
        // Public URL not available for private buckets
      }

      return {
        path: data.path,
        publicUrl,
      };
    } catch (error) {
      console.error('Error in test file upload:', error);
      throw error;
    }
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .download(path);

      if (error) {
        throw new Error(`Supabase test download failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Download succeeded but no data returned');
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error in test file download:', error);
      throw error;
    }
  }

  async fileExists(bucket: string, path: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop(),
        });

      if (error) {
        if (error.message.includes('not found')) {
          return false;
        }
        throw new Error(`Failed to check file existence: ${error.message}`);
      }

      return (data || []).length > 0;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  async deleteFiles(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    try {
      const { error } = await this.client.storage.from(bucket).remove(paths);

      if (error) {
        throw new Error(`Supabase test delete failed: ${error.message}`);
      }

      // Remove from tracking
      this.uploadedFiles = this.uploadedFiles.filter(
        file => !(file.bucket === bucket && paths.includes(file.path))
      );
    } catch (error) {
      console.error('Error deleting test files:', error);
      throw error;
    }
  }

  private async cleanupUploadedFiles(): Promise<void> {
    const bucketGroups = this.uploadedFiles.reduce(
      (groups, file) => {
        if (!groups[file.bucket]) {
          groups[file.bucket] = [];
        }
        groups[file.bucket].push(file.path);
        return groups;
      },
      {} as Record<string, string[]>
    );

    for (const [bucket, paths] of Object.entries(bucketGroups)) {
      try {
        await this.deleteFiles(bucket, paths);
      } catch (error) {
        console.warn(`Failed to cleanup files in bucket ${bucket}:`, error);
      }
    }
  }

  private async cleanupCreatedBuckets(): Promise<void> {
    for (const bucketName of this.createdBuckets) {
      try {
        const { error } = await this.client.storage.deleteBucket(bucketName);
        if (error) {
          console.warn(
            `Failed to delete test bucket ${bucketName}:`,
            error.message
          );
        }
      } catch (error) {
        console.warn(`Error deleting test bucket ${bucketName}:`, error);
      }
    }
  }
}
