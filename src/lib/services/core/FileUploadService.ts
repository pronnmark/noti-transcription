// File Upload Service - Single Responsibility Principle
// Handles all file upload logic in one place (DRY principle)

import { ValidationError } from '../../errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { servicesDebug, debugPerformance, debugError } from '../../utils';
import { RepositoryFactory } from '../../database/repositories';
import { StorageConfigManager } from '../../config';

const execAsync = promisify(exec);

export interface UploadOptions {
  speakerCount?: number;
  isDraft?: boolean;
  allowDuplicates?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: number;
    provider?: string;
  };
}

export interface UploadResult {
  fileId: number;
  message: string;
  isDraft: boolean;
  duration?: number;
  transcriptionStarted: boolean;
}

export class FileUploadService {
  private readonly VALID_MIME_TYPES = [
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/flac',
    'audio/x-flac',
    'audio/aac',
    'audio/x-aac',
  ];

  private readonly VALID_EXTENSIONS = [
    'mp3',
    'wav',
    'm4a',
    'mp4',
    'webm',
    'ogg',
    'flac',
    'aac',
  ];

  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly storageConfig = StorageConfigManager.getInstance();

  constructor() {
    console.log('[FileUploadService] Initialized with Supabase Storage');
  }

  async uploadFile(
    file: File,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const startTime = Date.now();

      // Log file details for debugging
      servicesDebug('Upload file called with:', {
        hasFile: !!file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        fileConstructor: file?.constructor?.name,
        options,
      });

      // Validate input (SOLID: Single Responsibility)
      this.validateFile(file);
      this.validateOptions(options);

      // Read file buffer
      // Handle both standard File API and Next.js File objects
      let buffer: Buffer;
      try {
        if (typeof file.arrayBuffer === 'function') {
          buffer = Buffer.from(await file.arrayBuffer());
        } else if (typeof file.stream === 'function') {
          // For Next.js File objects that might only have stream()
          const chunks: Uint8Array[] = [];
          const reader = file.stream().getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        } else {
          throw new Error(
            'Unable to read file data - no arrayBuffer or stream method available',
          );
        }
      } catch (error) {
        debugError(error, 'services', {
          operation: 'readFileBuffer',
          fileName: file.name,
        });
        throw new Error('Failed to read file data');
      }

      // Generate file hash for duplicate detection
      const fileHash = this.generateFileHash(buffer);

      // Check for duplicates (unless explicitly allowed)
      if (!options.allowDuplicates) {
        // await this.checkForDuplicates(file, fileHash); // Disabled for testing
      }

      // Save file to Supabase Storage
      const { fileName, storagePath } = await this.saveFileToSupabase(
        file,
        buffer,
      );

      // Extract audio metadata (download temporarily for ffprobe)
      const duration = await this.extractDurationFromSupabase(
        storagePath,
        fileName,
      );

      // Create database record with Supabase path
      const audioFile = await this.createDatabaseRecord(
        file,
        fileName,
        storagePath,
        fileHash,
        duration,
        options.location,
      );

      // Start transcription if not a draft
      let transcriptionStarted = false;
      if (!options.isDraft) {
        transcriptionStarted = await this.startTranscription(
          audioFile.id,
          storagePath,
          options.speakerCount,
        );
      }

      debugPerformance('File upload completed', startTime, 'services');

      return {
        fileId: audioFile.id,
        message: options.isDraft
          ? 'Draft recording saved successfully'
          : 'File uploaded successfully, transcription started',
        isDraft: !!options.isDraft,
        duration,
        transcriptionStarted,
      };
    } catch (error) {
      console.error('[FileUploadService] Upload failed:', error);
      throw error;
    }
  }

  private validateFile(file: File): void {
    // Check if file is a valid File object
    // In Next.js, the File might be a special object, so check for essential properties
    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Check if it has the essential File properties
    if (typeof file.size !== 'number' || typeof file.name !== 'string') {
      throw new ValidationError(
        'Invalid file object - missing required properties',
      );
    }

    // Check file size
    if (file.size === 0) {
      throw new ValidationError('File is empty');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const baseMimeType = file.type.split(';')[0].trim();

    const isValidType =
      this.VALID_MIME_TYPES.includes(baseMimeType) ||
      this.VALID_MIME_TYPES.includes(file.type) ||
      (file.type === 'application/octet-stream' &&
        this.VALID_EXTENSIONS.includes(fileExtension || ''));

    if (!isValidType) {
      throw new ValidationError(
        `Invalid file type: ${file.type}. Supported formats: ${this.VALID_EXTENSIONS.join(', ')}`,
      );
    }
  }

  private validateOptions(options: UploadOptions): void {
    if (options.speakerCount !== undefined) {
      if (
        typeof options.speakerCount !== 'number' ||
        options.speakerCount < 1 ||
        options.speakerCount > 10
      ) {
        throw new ValidationError(
          'Speaker count must be a number between 1 and 10',
        );
      }
    }

    if (options.location) {
      const { latitude, longitude, accuracy, provider } = options.location;

      if (latitude < -90 || latitude > 90) {
        throw new ValidationError(
          'Invalid latitude: must be between -90 and 90',
        );
      }

      if (longitude < -180 || longitude > 180) {
        throw new ValidationError(
          'Invalid longitude: must be between -180 and 180',
        );
      }

      if (accuracy !== undefined && accuracy < 0) {
        throw new ValidationError('Invalid accuracy: must be positive');
      }

      if (provider && !['gps', 'network', 'passive'].includes(provider)) {
        throw new ValidationError('Invalid location provider');
      }

      servicesDebug('📍 Location data validated:', options.location);
    }
  }

  private generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async checkForDuplicates(
    file: File,
    fileHash: string,
  ): Promise<void> {
    const audioService = new (await import('./AudioService')).AudioService();

    const duplicateCheck = await audioService.checkForDuplicates({
      fileHash,
      originalFileName: file.name,
      fileSize: file.size,
    });

    if (duplicateCheck.isDuplicate) {
      const metadata = {
        duplicateType: duplicateCheck.duplicateType,
        message: duplicateCheck.message,
        existingFile: duplicateCheck.existingFile
          ? {
            id: duplicateCheck.existingFile.id,
            originalFileName: duplicateCheck.existingFile.originalFileName,
            uploadedAt: duplicateCheck.existingFile.uploadedAt,
            duration: duplicateCheck.existingFile.duration,
          }
          : null,
      };

      const error = new ValidationError(
        'Duplicate file detected',
        'file',
        undefined,
        [],
        metadata,
      );
      throw error;
    }
  }

  private async saveFileToSupabase(
    file: File,
    buffer: Buffer,
  ): Promise<{ fileName: string; storagePath: string }> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;

    // Generate unique storage path: uploads/{timestamp}/{fileName}
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const storagePath = `uploads/${timestamp}/${fileName}`;

    try {
      // Get Supabase Storage service
      const { SupabaseStorageService } = await import(
        './SupabaseStorageService'
      );
      const supabaseStorageService = new SupabaseStorageService();

      // Upload to Supabase Storage
      const uploadResult = await supabaseStorageService.uploadFile({
        bucket: this.storageConfig.getAudioBucket(),
        path: storagePath,
        file: buffer,
        contentType: file.type || `audio/${fileExtension}`,
        cacheControl: '3600',
      });

      servicesDebug('File saved to Supabase Storage', {
        fileName,
        originalName: file.name,
        size: file.size,
        storagePath: uploadResult.path,
        publicUrl: uploadResult.publicUrl,
      });

      return { fileName, storagePath: uploadResult.path };
    } catch (error) {
      debugError(error, 'services', {
        operation: 'saveFileToSupabase',
        fileName,
        bucket: this.storageConfig.getAudioBucket(),
      });
      // Preserve original error message for better debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save file to storage: ${errorMessage}`);
    }
  }

  private async extractDurationFromSupabase(
    storagePath: string,
    fileName: string,
  ): Promise<number> {
    try {
      // Download file temporarily for ffprobe analysis
      const { SupabaseStorageService } = await import(
        './SupabaseStorageService'
      );
      const supabaseStorageService = new SupabaseStorageService();

      const fileBuffer = await supabaseStorageService.downloadFile(
        this.storageConfig.getAudioBucket(),
        storagePath,
      );

      // Create temporary file for ffprobe
      const tempDir = '/tmp';
      const tempPath = join(tempDir, `temp_${fileName}`);

      try {
        await fs.writeFile(tempPath, fileBuffer);

        const { stdout } = await execAsync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tempPath}"`,
        );
        const duration = Math.round(parseFloat(stdout.trim()) || 0);

        // Clean up temp file
        await fs.unlink(tempPath).catch(() => {});

        console.log(
          `[FileUploadService] Extracted audio duration from Supabase file: ${duration}s`,
        );
        return duration;
      } catch (ffprobeError) {
        // Clean up temp file on error
        await fs.unlink(tempPath).catch(() => {});
        throw ffprobeError;
      }
    } catch (error) {
      console.warn(
        '[FileUploadService] Failed to extract duration from Supabase file:',
        error,
      );
      return 0;
    }
  }

  private async createDatabaseRecord(
    file: File,
    fileName: string,
    storagePath: string,
    fileHash: string,
    duration: number,
    location?: UploadOptions['location'],
  ) {
    const audioRepository = RepositoryFactory.audioRepository;

    return await audioRepository.create({
      file_name: storagePath, // Store the Supabase storage path as file_name
      original_file_name: file.name,
      original_file_type: file.type || 'audio/mpeg',
      file_size: file.size,
      file_hash: fileHash,
      duration,
      // Include location data if provided
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      location_accuracy: location?.accuracy || null,
      location_timestamp: location?.timestamp
        ? new Date(location.timestamp)
        : null,
      location_provider: location?.provider || null,
    });
  }

  private async startTranscription(
    fileId: number,
    storagePath: string,
    speakerCount?: number,
  ): Promise<boolean> {
    try {
      // Convert to WAV if needed (download from Supabase temporarily)
      const wavPath = await this.ensureWavFormatFromSupabase(storagePath);

      // Start transcription through repository
      const transcriptionRepository = RepositoryFactory.transcriptionRepository;

      // Create transcription job
      const job = await transcriptionRepository.create({
        file_id: fileId,
        language: 'auto',
        model_size: 'large-v3',
        diarization: true,
        status: 'pending',
      });

      // Start background transcription (don't await)
      this.startBackgroundTranscription(job.id, wavPath, speakerCount).catch(
        error => {
          console.error(
            '[FileUploadService] Background transcription failed:',
            error,
          );
        },
      );

      return true;
    } catch (error) {
      console.error(
        '[FileUploadService] Failed to start transcription:',
        error,
      );
      return false;
    }
  }

  private async ensureWavFormatFromSupabase(
    storagePath: string,
  ): Promise<string> {
    try {
      // Download file from Supabase
      const { SupabaseStorageService } = await import(
        './SupabaseStorageService'
      );
      const supabaseStorageService = new SupabaseStorageService();

      const fileBuffer = await supabaseStorageService.downloadFile(
        this.storageConfig.getAudioBucket(),
        storagePath,
      );

      // Create temporary files
      const tempDir = '/tmp';
      const originalExt = storagePath.split('.').pop()?.toLowerCase() || 'mp3';
      const tempFileName = `temp_${uuidv4()}`;
      const originalPath = join(tempDir, `${tempFileName}.${originalExt}`);
      const wavPath = join(tempDir, `${tempFileName}.wav`);

      try {
        // Write original file
        await fs.writeFile(originalPath, fileBuffer);

        // Convert to WAV if not already WAV
        if (originalExt === 'wav') {
          return originalPath; // Already WAV format
        }

        await execAsync(
          `ffmpeg -i "${originalPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`,
        );

        // Clean up original temp file
        await fs.unlink(originalPath).catch(() => {});

        console.log(
          `[FileUploadService] Converted Supabase audio to WAV format: ${wavPath}`,
        );

        return wavPath;
      } catch (conversionError) {
        // Clean up temp files on error
        await fs.unlink(originalPath).catch(() => {});
        await fs.unlink(wavPath).catch(() => {});
        throw conversionError;
      }
    } catch (error) {
      console.warn(
        '[FileUploadService] Failed to convert Supabase file to WAV:',
        error,
      );
      throw error;
    }
  }

  private async startBackgroundTranscription(
    jobId: number,
    wavPath: string,
    speakerCount?: number,
  ): Promise<void> {
    // Import transcription logic
    const { startTranscription } = await import('../transcription');
    await startTranscription(jobId, wavPath, speakerCount);
  }
}
