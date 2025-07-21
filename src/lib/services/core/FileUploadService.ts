// File Upload Service - Single Responsibility Principle
// Handles all file upload logic in one place (DRY principle)

import { BaseService, ValidationRules } from './BaseService';
import { createError } from '../../errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface UploadOptions {
  speakerCount?: number;
  isDraft?: boolean;
  allowDuplicates?: boolean;
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
  private readonly UPLOAD_DIR = join(process.cwd(), 'data', 'audio_files');

  constructor() {
    super('FileUploadService');
  }

  protected async onInitialize(): Promise<void> {
    // Ensure upload directory exists
    await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
    this._logger.info('File upload service initialized', { uploadDir: this.UPLOAD_DIR });
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('File upload service destroyed');
  }

  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    return this.executeWithErrorHandling('uploadFile', async () => {
      // Log file details for debugging
      this._logger.debug('Upload file called with:', {
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
        this._logger.error('Failed to read file buffer', error);
        throw createError.internal('Failed to read file data');
      }

      // Generate file hash for duplicate detection
      const fileHash = this.generateFileHash(buffer);

      // Check for duplicates (unless explicitly allowed)
      if (!options.allowDuplicates) {
        await this.checkForDuplicates(file, fileHash);
      }

      // Save file to disk
      const { fileName, filePath } = await this.saveFileToDisk(file, buffer);

      // Extract audio metadata
      const duration = await this.extractDuration(filePath);

      // Create database record
      const audioFile = await this.createDatabaseRecord(file, fileName, fileHash, duration);

      // Start transcription if not a draft
      let transcriptionStarted = false;
      if (!options.isDraft) {
        transcriptionStarted = await this.startTranscription(audioFile.id, filePath, options.speakerCount);
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
      const error = createError.validation('Duplicate file detected');
      error.metadata = {
        duplicateType: duplicateCheck.duplicateType,
        message: duplicateCheck.message,
        existingFile: duplicateCheck.existingFile ? {
          id: duplicateCheck.existingFile.id,
          originalFileName: duplicateCheck.existingFile.originalFileName,
          uploadedAt: duplicateCheck.existingFile.uploadedAt,
          duration: duplicateCheck.existingFile.duration,
        } : null,
      };
      error.statusCode = 409; // Conflict
      throw error;
    }
  }

  private async saveFileToDisk(file: File, buffer: Buffer): Promise<{ fileName: string; filePath: string }> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = join(this.UPLOAD_DIR, fileName);

    await fs.writeFile(filePath, buffer);

    this._logger.info('File saved to disk', {
      fileName,
      originalName: file.name,
      size: file.size,
      path: filePath,
    });

    return { fileName, filePath };
  }

  private async extractDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      );
      const duration = Math.round(parseFloat(stdout.trim()) || 0);
      this._logger.debug('Extracted audio duration', { filePath, duration });
      return duration;
    } catch (error) {
      this._logger.warn('Failed to extract duration', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  private async createDatabaseRecord(file: File, fileName: string, fileHash: string, duration: number) {
    const { getServiceLocator } = await import('../ServiceLocator');
    const { audioService } = getServiceLocator();

    return await audioService.createFile({
      fileName,
      originalFileName: file.name,
      originalFileType: file.type || 'audio/mpeg',
      fileSize: file.size,
      fileHash,
      duration,
    });
  }

  private async startTranscription(fileId: number, filePath: string, speakerCount?: number): Promise<boolean> {
    try {
      // Convert to WAV if needed
      const wavPath = await this.ensureWavFormat(filePath);

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

  private async ensureWavFormat(filePath: string): Promise<string> {
    if (filePath.endsWith('.wav')) {
      return filePath;
    }

    const wavPath = filePath.replace(/\.[^/.]+$/, '.wav');

    try {
      await execAsync(
        `ffmpeg -i "${filePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`,
      );
      this._logger.info('Converted audio to WAV format', { original: filePath, wav: wavPath });
      return wavPath;
    } catch (error) {
      this._logger.warn('Failed to convert to WAV, using original format', error instanceof Error ? error : new Error(String(error)));
      return filePath;
    }
  }

  private async startBackgroundTranscription(jobId: number, wavPath: string, speakerCount?: number): Promise<void> {
    // Import transcription logic
    const { startTranscription } = await import('../../transcription');
    await startTranscription(jobId, wavPath, speakerCount);
  }
}
