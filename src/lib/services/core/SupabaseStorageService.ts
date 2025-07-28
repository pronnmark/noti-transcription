import { BaseService } from './BaseService';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { servicesDebug, debugError } from '../../utils';
import { createError } from '../../errors';

export interface SupabaseUploadOptions {
  bucket: string;
  path: string;
  file: File | Buffer;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

export interface SupabaseUploadResult {
  path: string;
  fullPath: string;
  publicUrl?: string;
}

export interface SupabaseDeleteOptions {
  bucket: string;
  paths: string[];
}

export class SupabaseStorageService extends BaseService {
  private client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;

  constructor() {
    super('SupabaseStorageService');
    
    // Get environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseKey) {
      throw new Error('Supabase key is required. Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Initialize Supabase client
    this.client = createClient(this.supabaseUrl, this.supabaseKey);
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Test connection and ensure buckets exist
      await this.ensureBucketsExist();
      this._logger.info('Supabase Storage service initialized', { 
        url: this.supabaseUrl,
        bucketsChecked: ['audio-files', 'transcripts']
      });
    } catch (error) {
      this._logger.error('Failed to initialize Supabase Storage service', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Supabase Storage service destroyed');
  }

  /**
   * Ensure required storage buckets exist
   */
  private async ensureBucketsExist(): Promise<void> {
    const requiredBuckets = [
      { name: 'audio-files', public: false },
      { name: 'transcripts', public: false }
    ];

    for (const bucket of requiredBuckets) {
      try {
        // Check if bucket exists
        const { data: existingBucket, error: listError } = await this.client.storage.getBucket(bucket.name);
        
        if (listError && listError.message.includes('not found')) {
          // Create bucket if it doesn't exist
          const { data, error: createError } = await this.client.storage.createBucket(bucket.name, {
            public: bucket.public,
            allowedMimeTypes: bucket.name === 'audio-files' 
              ? ['audio/*', 'video/*'] 
              : ['application/json', 'text/*'],
            fileSizeLimit: bucket.name === 'audio-files' ? 100 * 1024 * 1024 : 10 * 1024 * 1024, // 100MB for audio, 10MB for transcripts
          });

          if (createError) {
            throw new Error(`Failed to create bucket ${bucket.name}: ${createError.message}`);
          }

          servicesDebug(`Created Supabase bucket: ${bucket.name}`);
        } else if (listError) {
          throw new Error(`Failed to check bucket ${bucket.name}: ${listError.message}`);
        } else {
          servicesDebug(`Bucket ${bucket.name} already exists`);
        }
      } catch (error) {
        debugError(error, 'services', { operation: 'ensureBucketsExist', bucket: bucket.name });
        throw error;
      }
    }
  }

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(options: SupabaseUploadOptions): Promise<SupabaseUploadResult> {
    return this.executeWithErrorHandling('uploadFile', async () => {
      servicesDebug('Uploading file to Supabase Storage', {
        bucket: options.bucket,
        path: options.path,
        contentType: options.contentType,
      });

      try {
        // Convert File to ArrayBuffer if needed
        let fileData: ArrayBuffer | Buffer;
        
        if (options.file instanceof Buffer) {
          fileData = options.file;
        } else if (options.file instanceof File) {
          fileData = await options.file.arrayBuffer();
        } else {
          throw new Error('Invalid file type. Expected File or Buffer.');
        }

        // Upload to Supabase Storage
        const { data, error } = await this.client.storage
          .from(options.bucket)
          .upload(options.path, fileData, {
            contentType: options.contentType,
            cacheControl: options.cacheControl || '3600',
            upsert: options.upsert || false,
          });

        if (error) {
          throw new Error(`Supabase upload failed: ${error.message}`);
        }

        if (!data) {
          throw new Error('Upload succeeded but no data returned');
        }

        // Get public URL if the bucket is public
        let publicUrl: string | undefined;
        try {
          const { data: urlData } = this.client.storage
            .from(options.bucket)
            .getPublicUrl(options.path);
          publicUrl = urlData.publicUrl;
        } catch (urlError) {
          // Public URL not available, which is fine for private buckets
          servicesDebug('Public URL not available (bucket may be private)', urlError);
        }

        const result: SupabaseUploadResult = {
          path: data.path,
          fullPath: data.fullPath,
          publicUrl,
        };

        servicesDebug('File uploaded successfully to Supabase Storage', result);
        return result;

      } catch (error) {
        debugError(error, 'services', { 
          operation: 'uploadFile', 
          bucket: options.bucket, 
          path: options.path 
        });
        throw createError.internal(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Download a file from Supabase Storage
   */
  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    return this.executeWithErrorHandling('downloadFile', async () => {
      servicesDebug('Downloading file from Supabase Storage', { bucket, path });

      try {
        const { data, error } = await this.client.storage
          .from(bucket)
          .download(path);

        if (error) {
          throw new Error(`Supabase download failed: ${error.message}`);
        }

        if (!data) {
          throw new Error('Download succeeded but no data returned');
        }

        // Convert Blob to Buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        servicesDebug('File downloaded successfully from Supabase Storage', {
          bucket,
          path,
          size: buffer.length,
        });

        return buffer;

      } catch (error) {
        debugError(error, 'services', { operation: 'downloadFile', bucket, path });
        throw createError.internal(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Delete files from Supabase Storage
   */
  async deleteFiles(options: SupabaseDeleteOptions): Promise<void> {
    return this.executeWithErrorHandling('deleteFiles', async () => {
      servicesDebug('Deleting files from Supabase Storage', {
        bucket: options.bucket,
        paths: options.paths,
      });

      try {
        const { data, error } = await this.client.storage
          .from(options.bucket)
          .remove(options.paths);

        if (error) {
          throw new Error(`Supabase delete failed: ${error.message}`);
        }

        servicesDebug('Files deleted successfully from Supabase Storage', {
          bucket: options.bucket,
          deletedCount: data?.length || 0,
        });

      } catch (error) {
        debugError(error, 'services', { 
          operation: 'deleteFiles', 
          bucket: options.bucket, 
          paths: options.paths 
        });
        throw createError.internal(`Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Get file URL (signed URL for private buckets)
   */
  async getFileUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string> {
    return this.executeWithErrorHandling('getFileUrl', async () => {
      try {
        // Try to get public URL first
        const { data: publicData } = this.client.storage
          .from(bucket)
          .getPublicUrl(path);

        // If the bucket is public, return the public URL
        if (publicData.publicUrl && !publicData.publicUrl.includes('sign')) {
          return publicData.publicUrl;
        }

        // Otherwise, create a signed URL
        const { data: signedData, error } = await this.client.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);

        if (error) {
          throw new Error(`Failed to create signed URL: ${error.message}`);
        }

        if (!signedData) {
          throw new Error('Signed URL creation succeeded but no data returned');
        }

        return signedData.signedUrl;

      } catch (error) {
        debugError(error, 'services', { operation: 'getFileUrl', bucket, path });
        throw createError.internal(`Failed to get file URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(bucket: string, path: string): Promise<boolean> {
    return this.executeWithErrorHandling('fileExists', async () => {
      try {
        const { data, error } = await this.client.storage
          .from(bucket)
          .list(path.split('/').slice(0, -1).join('/'), {
            search: path.split('/').pop(),
          });

        if (error) {
          // If error is "not found", the file doesn't exist
          if (error.message.includes('not found')) {
            return false;
          }
          throw new Error(`Failed to check file existence: ${error.message}`);
        }

        return (data || []).length > 0;

      } catch (error) {
        debugError(error, 'services', { operation: 'fileExists', bucket, path });
        return false; // Assume file doesn't exist on error
      }
    });
  }

  /**
   * Get file info/metadata
   */
  async getFileInfo(bucket: string, path: string): Promise<any> {
    return this.executeWithErrorHandling('getFileInfo', async () => {
      try {
        const { data, error } = await this.client.storage
          .from(bucket)
          .list(path.split('/').slice(0, -1).join('/'), {
            search: path.split('/').pop(),
          });

        if (error) {
          throw new Error(`Failed to get file info: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error('File not found');
        }

        return data[0]; // Return first match

      } catch (error) {
        debugError(error, 'services', { operation: 'getFileInfo', bucket, path });
        throw createError.internal(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }
}