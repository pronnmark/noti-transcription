// File Upload Service - Single Responsibility Principle
// Handles all file upload logic in one place (DRY principle)

import { BaseService, ValidationRules } from './BaseService';
import { createError, ValidationError } from '../../errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { servicesDebug, debugPerformance, debugError } from '../../utils';

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

export class FileUploadService extends BaseService {
  private readonly VALID_MIME_TYPES = [
    'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4',
    'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/x-m4a',
    'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/x-aac',
  ];

  private readonly VALID_EXTENSIONS = [
    'mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'aac',
  ];

  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly SUPABASE_BUCKET = 'audio-files';

  constructor() {
    super('FileUploadService');
  }

  protected async onInitialize(): Promise<void> {
    // Supabase Storage service will handle bucket creation
    this._logger.info('File upload service initialized with Supabase Storage');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('File upload service destroyed');
  }

  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    return this.executeWithErrorHandling('uploadFile', async () => {
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
          throw new Error('Unable to read file data - no arrayBuffer or stream method available');
        }
      } catch (error) {
        debugError(error, 'services', { operation: 'readFileBuffer', fileName: file.name });
        throw createError.internal('Failed to read file data');
      }

      // Generate file hash for duplicate detection
      const fileHash = this.generateFileHash(buffer);

      // Check for duplicates (unless explicitly allowed)
      if (!options.allowDuplicates) {
        await this.checkForDuplicates(file, fileHash);
      }

      // Save file to Supabase Storage
      const { fileName, storagePath } = await this.saveFileToSupabase(file, buffer);

      // Extract audio metadata (download temporarily for ffprobe)
      const duration = await this.extractDurationFromSupabase(storagePath, fileName);

      // Create database record with Supabase path
      const audioFile = await this.createDatabaseRecord(file, fileName, storagePath, fileHash, duration, options.location);

      // Start transcription if not a draft
      let transcriptionStarted = false;
      if (!options.isDraft) {
        transcriptionStarted = await this.startTranscription(audioFile.id, storagePath, options.speakerCount);
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
    });
  }

  private validateFile(file: File): void {
    // Check if file is a valid File object
    // In Next.js, the File might be a special object, so check for essential properties
    if (!file) {
      throw createError.validation('No file provided');
    }

    // Check if it has the essential File properties
    if (typeof file.size !== 'number' || typeof file.name !== 'string') {
      throw createError.validation('Invalid file object - missing required properties');
    }

    // Check file size
    if (file.size === 0) {
      throw createError.validation('File is empty');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw createError.validation(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const baseMimeType = file.type.split(';')[0].trim();

    const isValidType = this.VALID_MIME_TYPES.includes(baseMimeType) ||
                       this.VALID_MIME_TYPES.includes(file.type) ||
                       (file.type === 'application/octet-stream' &&
                        this.VALID_EXTENSIONS.includes(fileExtension || ''));

    if (!isValidType) {
      throw createError.validation(
        `Invalid file type: ${file.type}. Supported formats: ${this.VALID_EXTENSIONS.join(', ')}`,
      );
    }
  }

  private validateOptions(options: UploadOptions): void {
    if (options.speakerCount !== undefined) {
      this.validateInput(options.speakerCount, [
        ValidationRules.isNumber('speakerCount'),
        ValidationRules.custom('speakerCount', (val) => val >= 1 && val <= 10, 'must be between 1 and 10'),
      ]);
    }

    if (options.location) {
      const { latitude, longitude, accuracy, provider } = options.location;
      
      if (latitude < -90 || latitude > 90) {
        throw createError.validation('Invalid latitude: must be between -90 and 90');
      }
      
      if (longitude < -180 || longitude > 180) {
        throw createError.validation('Invalid longitude: must be between -180 and 180');
      }
      
      if (accuracy !== undefined && accuracy < 0) {
        throw createError.validation('Invalid accuracy: must be positive');
      }
      
      if (provider && !['gps', 'network', 'passive'].includes(provider)) {
        throw createError.validation('Invalid location provider');
      }
      
      servicesDebug('📍 Location data validated:', options.location);
    }
  }

  private generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async checkForDuplicates(file: File, fileHash: string): Promise<void> {
    const { getServiceLocator } = await import('../ServiceLocator');
    const { audioService } = getServiceLocator();

    const duplicateCheck = await audioService.checkForDuplicates({
      fileHash,
      originalFileName: file.name,
      fileSize: file.size,
    });

    if (duplicateCheck.isDuplicate) {
      const metadata = {
        duplicateType: duplicateCheck.duplicateType,
        message: duplicateCheck.message,
        existingFile: duplicateCheck.existingFile ? {
          id: duplicateCheck.existingFile.id,
          originalFileName: duplicateCheck.existingFile.originalFileName,
          uploadedAt: duplicateCheck.existingFile.uploadedAt,
          duration: duplicateCheck.existingFile.duration,
        } : null,
      };
      
      const error = new ValidationError(
        'Duplicate file detected',
        'file',
        undefined,
        [],
        metadata
      );
      throw error;
    }
  }

  private async saveFileToSupabase(file: File, buffer: Buffer): Promise<{ fileName: string; storagePath: string }> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Generate unique storage path: uploads/{timestamp}/{fileName}
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const storagePath = `uploads/${timestamp}/${fileName}`;

    try {
      // Get Supabase Storage service
      const { getServiceLocator } = await import('../ServiceLocator');
      const { supabaseStorageService } = getServiceLocator();

      // Upload to Supabase Storage
      const uploadResult = await supabaseStorageService.uploadFile({
        bucket: this.SUPABASE_BUCKET,
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
      debugError(error, 'services', { operation: 'saveFileToSupabase', fileName });
      throw createError.internal('Failed to save file to storage');
    }
  }

  private async extractDurationFromSupabase(storagePath: string, fileName: string): Promise<number> {
    try {
      // Download file temporarily for ffprobe analysis
      const { getServiceLocator } = await import('../ServiceLocator');
      const { supabaseStorageService } = getServiceLocator();
      
      const fileBuffer = await supabaseStorageService.downloadFile(this.SUPABASE_BUCKET, storagePath);
      
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
        
        this._logger.debug('Extracted audio duration from Supabase file', { storagePath, duration });
        return duration;
        
      } catch (ffprobeError) {
        // Clean up temp file on error
        await fs.unlink(tempPath).catch(() => {});
        throw ffprobeError;
      }
      
    } catch (error) {
      this._logger.warn('Failed to extract duration from Supabase file', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  private async createDatabaseRecord(
    file: File, 
    fileName: string, 
    storagePath: string,
    fileHash: string, 
    duration: number,
    location?: UploadOptions['location']
  ) {
    const { getServiceLocator } = await import('../ServiceLocator');
    const { audioService } = getServiceLocator();

    return await audioService.createFile({
      fileName: storagePath, // Store the Supabase storage path as fileName
      originalFileName: file.name,
      originalFileType: file.type || 'audio/mpeg',
      fileSize: file.size,
      fileHash,
      duration,
      // Include location data if provided
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      locationAccuracy: location?.accuracy || null,
      locationTimestamp: location?.timestamp ? new Date(location.timestamp) : null,
      locationProvider: location?.provider || null,
    });
  }

  private async startTranscription(fileId: number, storagePath: string, speakerCount?: number): Promise<boolean> {
    try {
      // Convert to WAV if needed (download from Supabase temporarily)
      const wavPath = await this.ensureWavFormatFromSupabase(storagePath);

      // Start transcription through service
      const { getServiceLocator } = await import('../ServiceLocator');
      const { transcriptionService } = getServiceLocator();

      // Create transcription job
      const job = await transcriptionService.createJob({
        fileId,
        language: 'auto',
        modelSize: 'large-v3',
        diarization: true,
        status: 'pending',
      });

      // Start background transcription (don't await)
      this.startBackgroundTranscription(job.id, wavPath, speakerCount).catch(error => {
        this._logger.error('Background transcription failed', error instanceof Error ? error : new Error(String(error)));
      });

      return true;
    } catch (error) {
      this._logger.error('Failed to start transcription', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private async ensureWavFormatFromSupabase(storagePath: string): Promise<string> {
    try {
      // Download file from Supabase
      const { getServiceLocator } = await import('../ServiceLocator');
      const { supabaseStorageService } = getServiceLocator();
      
      const fileBuffer = await supabaseStorageService.downloadFile(this.SUPABASE_BUCKET, storagePath);
      
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
        
        this._logger.info('Converted Supabase audio to WAV format', { 
          storagePath, 
          tempWavPath: wavPath 
        });
        
        return wavPath;
        
      } catch (conversionError) {
        // Clean up temp files on error
        await fs.unlink(originalPath).catch(() => {});
        await fs.unlink(wavPath).catch(() => {});
        throw conversionError;
      }
      
    } catch (error) {
      this._logger.warn('Failed to convert Supabase file to WAV', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async startBackgroundTranscription(jobId: number, wavPath: string, speakerCount?: number): Promise<void> {
    // Import transcription logic
    const { startTranscription } = await import('../transcription');
    await startTranscription(jobId, wavPath, speakerCount);
  }
}
