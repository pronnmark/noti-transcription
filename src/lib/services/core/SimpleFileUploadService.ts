import { BaseService } from './BaseService';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createError } from '../../errors';

const execAsync = promisify(exec);

export interface SimpleUploadResult {
  fileId: number;
  fileName: string;
  message: string;
  duration?: number;
  isDraft?: boolean;
  transcriptionStarted?: boolean;
}

/**
 * Simplified FileUploadService following KISS principle
 * Each method has single responsibility and explicit error handling
 */
export class SimpleFileUploadService extends BaseService {
  private readonly UPLOAD_DIR = join(process.cwd(), 'data', 'audio_files');
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  constructor() {
    super('SimpleFileUploadService');
  }

  protected async onInitialize(): Promise<void> {
    // Ensure upload directory exists
    try {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
      this._logger.info('Upload directory ready', { dir: this.UPLOAD_DIR });
    } catch (error) {
      this._logger.error('Failed to create upload directory', error);
      throw error;
    }
  }

  protected async onDestroy(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Main upload method - simplified and explicit
   */
  async uploadFile(file: File, options: {
    isDraft?: boolean;
    speakerCount?: number;
    allowDuplicates?: boolean;
  } = {}): Promise<SimpleUploadResult> {
    this._logger.info('Starting file upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isDraft: options.isDraft,
      speakerCount: options.speakerCount,
      allowDuplicates: options.allowDuplicates,
    });

    try {
      // Step 1: Validate file
      this.validateFileSimple(file);

      // Step 2: Read file data
      const buffer = await this.readFileBuffer(file);

      // Step 3: Generate file hash
      const fileHash = this.generateHash(buffer);

      // Step 4: Save file to disk
      const { fileName, filePath } = await this.saveFile(file, buffer);

      // Step 5: Extract duration (optional - don't fail if it doesn't work)
      const duration = await this.tryExtractDuration(filePath);

      // Step 6: Create database record
      const audioFile = await this.createAudioRecord({
        fileName,
        originalFileName: file.name,
        originalFileType: file.type || 'audio/mpeg',
        fileSize: file.size,
        fileHash,
        duration: duration || 0,
      });

      // Step 7: Start transcription if not draft (optional)
      if (!options.isDraft) {
        this.startTranscriptionAsync(audioFile.id, filePath).catch(error => {
          this._logger.warn('Failed to start transcription', error);
        });
      }

      this._logger.info('File uploaded successfully', {
        fileId: audioFile.id,
        fileName,
        duration,
      });

      return {
        fileId: audioFile.id,
        fileName,
        message: options.isDraft
          ? 'Draft saved successfully'
          : 'File uploaded successfully',
        duration,
        isDraft: !!options.isDraft,
        transcriptionStarted: !options.isDraft,
      };

    } catch (error) {
      this._logger.error('Upload failed', error);
      throw error;
    }
  }

  /**
   * Simple file validation
   */
  private validateFileSimple(file: File): void {
    if (!file) {
      throw createError.validation('No file provided');
    }

    if (!file.size || file.size === 0) {
      throw createError.validation('File is empty');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw createError.validation(`File too large (max ${this.MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Basic mime type check
    const validTypes = ['audio/', 'video/'];
    const hasValidType = validTypes.some(type => file.type?.startsWith(type));

    if (file.type && !hasValidType) {
      this._logger.warn('Unusual file type', { type: file.type });
    }
  }

  /**
   * Read file buffer with proper error handling
   */
  private async readFileBuffer(file: File): Promise<Buffer> {
    try {
      if (typeof file.arrayBuffer === 'function') {
        return Buffer.from(await file.arrayBuffer());
      }

      // Fallback for different File implementations
      if (typeof file.stream === 'function') {
        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return Buffer.concat(chunks);
      }

      throw new Error('Cannot read file - no arrayBuffer or stream method');
    } catch (error) {
      this._logger.error('Failed to read file buffer', error);
      throw createError.internal('Failed to read file data');
    }
  }

  /**
   * Generate file hash
   */
  private generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Save file to disk
   */
  private async saveFile(file: File, buffer: Buffer): Promise<{ fileName: string; filePath: string }> {
    const fileName = `${uuidv4()}_${file.name}`;
    const filePath = join(this.UPLOAD_DIR, fileName);

    try {
      await fs.writeFile(filePath, buffer);
      this._logger.debug('File saved', { filePath });
      return { fileName, filePath };
    } catch (error) {
      this._logger.error('Failed to save file', error);
      throw createError.internal('Failed to save file to disk');
    }
  }

  /**
   * Try to extract audio duration - don't fail if ffprobe is not available
   */
  private async tryExtractDuration(filePath: string): Promise<number | null> {
    try {
      const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());

      if (!isNaN(duration)) {
        this._logger.debug('Duration extracted', { duration });
        return Math.round(duration);
      }
    } catch (error) {
      this._logger.warn('Could not extract duration', error);
    }

    return null;
  }

  /**
   * Create database record
   */
  private async createAudioRecord(data: any): Promise<any> {
    try {
      this._logger.debug('Creating database record directly...');

      // Import database and schema directly to avoid service dependencies
      const { getDb } = await import('../../database/client');
      const { audioFiles } = await import('../../database/schema/audio');

      const db = getDb();
      this._logger.debug('Got database instance');

      const [result] = await db.insert(audioFiles).values(data).returning();

      this._logger.debug('Database record created:', { id: result.id });
      return result;
    } catch (error) {
      this._logger.error('Failed to create database record', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        data,
      });
      throw createError.internal('Failed to save file information to database: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Start transcription asynchronously - fire and forget
   */
  private async startTranscriptionAsync(fileId: number, filePath: string): Promise<void> {
    try {
      // For now, just log that transcription would start
      // In production, this would create a job in a queue
      this._logger.info('Transcription would start for file', { fileId, filePath });

      // Optional: Create a transcription record directly in the database
      // const { getDb } = await import('../../database/client');
      // const { transcripts } = await import('../../database/schema/transcripts');
      // await db.insert(transcripts).values({ fileId, status: 'pending' });

    } catch (error) {
      this._logger.error('Failed to start transcription', error);
      // Don't throw - this is optional
    }
  }
}
