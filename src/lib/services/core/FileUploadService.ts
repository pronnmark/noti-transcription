import crypto from 'crypto';
import { ErrorHandler } from '../../utils/errorHandler';
import { ValidationUtils } from '../../utils/validation';
import { configManager } from '../../utils/configuration';
import { FileValidator } from './FileValidator';
import { AudioConverter } from './AudioConverter';
import { TranscriptionOrchestrator } from './TranscriptionOrchestrator';
import { SupabaseStorageService } from './SupabaseStorageService';
import { RepositoryFactory } from '../../database/repositories';
import { v4 as uuidv4 } from 'uuid';

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

/**
 * FileUploadService - Refactored to follow Single Responsibility Principle
 * Now orchestrates file upload workflow using focused services
 */
export class FileUploadService {
  private storageService: SupabaseStorageService;

  constructor() {
    this.storageService = new SupabaseStorageService();
  }

  async uploadFile(
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    return await ErrorHandler.serviceMethod(async () => {
      // Validate inputs using focused validator
      FileValidator.validateAudioFile(file);
      FileValidator.validateUploadOptions(options);

      // Read file buffer
      const buffer = await this.readFileBuffer(file);

      // Generate file hash for duplicate detection
      const fileHash = this.generateFileHash(buffer);

      // Check for duplicates (unless explicitly allowed)
      if (!options.allowDuplicates) {
        await this.checkForDuplicates(file, fileHash);
      }

      // Save file to storage
      const { fileName, storagePath } = await this.saveFileToStorage(file, buffer);

      // Extract audio metadata
      const duration = await this.extractAudioDuration(storagePath);

      // Create database record
      const audioFile = await this.createDatabaseRecord(
        file,
        fileName,
        storagePath,
        fileHash,
        duration,
        options.location
      );

      // Start transcription if not a draft
      let transcriptionStarted = false;
      if (!options.isDraft) {
        await TranscriptionOrchestrator.createTranscriptionJob(
          audioFile.id,
          storagePath,
          {
            speakerCount: options.speakerCount,
            enableDiarization: true,
          }
        );
        
        await TranscriptionOrchestrator.startBackgroundTranscription(
          audioFile.id,
          storagePath,
          { speakerCount: options.speakerCount }
        );
        
        transcriptionStarted = true;
      }

      return {
        fileId: audioFile.id,
        message: options.isDraft
          ? 'Draft recording saved successfully'
          : 'File uploaded successfully, transcription started',
        isDraft: !!options.isDraft,
        duration,
        transcriptionStarted,
      };
    }, {
      service: 'FileUploadService',
      operation: 'uploadFile',
      metadata: { 
        fileName: file.name,
        fileSize: file.size,
        isDraft: options.isDraft,
        hasSpeakerCount: !!options.speakerCount
      }
    });
  }

  /**
   * Read file buffer from File object (handles both standard and Next.js File objects)
   */
  private async readFileBuffer(file: File): Promise<Buffer> {
    try {
      if (typeof file.arrayBuffer === 'function') {
        return Buffer.from(await file.arrayBuffer());
      } else if (typeof file.stream === 'function') {
        // For Next.js File objects that might only have stream()
        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      } else {
        throw new Error(
          'Unable to read file data - no arrayBuffer or stream method available'
        );
      }
    } catch (error) {
      throw new Error(`Failed to read file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async checkForDuplicates(file: File, fileHash: string): Promise<void> {
    const { AudioService } = await import('./AudioService');
    const audioService = new AudioService();

    const duplicateCheck = await audioService.checkForDuplicates({
      fileHash,
      originalFileName: file.name,
      fileSize: file.size,
    });

    if (duplicateCheck.isDuplicate) {
      throw new Error(`Duplicate file detected: ${duplicateCheck.message}`);
    }
  }

  private async saveFileToStorage(file: File, buffer: Buffer): Promise<{ fileName: string; storagePath: string }> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const storagePath = `uploads/${timestamp}/${fileName}`;

    const storageConfig = configManager.getStorageConfig();
    
    await this.storageService.uploadFile({
      bucket: storageConfig.buckets.audioFiles,
      path: storagePath,
      file: buffer,
      contentType: file.type || `audio/${fileExtension}`,
      cacheControl: '3600',
    });

    return { fileName, storagePath };
  }

  private async extractAudioDuration(storagePath: string): Promise<number> {
    try {
      const storageConfig = configManager.getStorageConfig();
      const fileBuffer = await this.storageService.downloadFile(
        storageConfig.buckets.audioFiles,
        storagePath
      );

      // Use AudioConverter to extract metadata
      const tempFileName = `temp_${uuidv4()}.${storagePath.split('.').pop()}`;
      const conversionResult = await AudioConverter.convertToWav(fileBuffer, tempFileName);
      
      // Cleanup temporary file
      await AudioConverter.cleanupTempFiles([conversionResult.outputPath]);
      
      return conversionResult.duration;
    } catch (error) {
      console.warn('Failed to extract duration:', error);
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
    const audioRepository = RepositoryFactory.audioRepository;

    return await audioRepository.create({
      file_name: storagePath, // Store the storage path as file_name
      original_file_name: file.name,
      original_file_type: file.type || 'audio/mpeg',
      file_size: file.size,
      file_hash: fileHash,
      duration,
      // Include location data if provided
      latitude: location?.latitude,
      longitude: location?.longitude,
      location_accuracy: location?.accuracy,
      location_timestamp: location?.timestamp
        ? new Date(location.timestamp).toISOString()
        : undefined,
      location_provider: location?.provider,
    });
  }
}
