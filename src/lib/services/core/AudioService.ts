import type { AudioRepository } from '../../database/repositories/AudioRepository';
import type { AudioStatsRepository } from '../../database/repositories/AudioStatsRepository';
import type { TranscriptionRepository } from '../../database/repositories/TranscriptRepository';
import type { AudioFile } from '../../database/client';
import { ValidationService } from '../ValidationService';
import { debugLog } from '../../utils/debug';

interface NewAudioFile {
  file_name: string;
  original_file_name: string;
  original_file_type: string;
  file_size: number;
  file_hash?: string;
  duration?: number;
  title?: string;
  peaks?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_timestamp?: string;
  location_provider?: string;
  recorded_at?: string;
}

// Constants for validation
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILENAME_LENGTH = 255;
const MAX_TITLE_LENGTH = 500;
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
];

export class AudioService {
  constructor(
    private audioRepository: AudioRepository,
    private audioStatsRepository: AudioStatsRepository,
    private transcriptionRepository: TranscriptionRepository,
    private validationService: ValidationService
  ) {}

  /**
   * Validate audio file data before creation
   */
  private validateAudioFileData(data: NewAudioFile): void {
    const errors: string[] = [];

    // File name validation
    const fileNameValidation = this.validationService.validateRequired(
      data.file_name,
      'File name'
    );
    if (!fileNameValidation.isValid) {
      errors.push(...fileNameValidation.errors);
    } else if (data.file_name.length > MAX_FILENAME_LENGTH) {
      errors.push(
        `File name too long (max ${MAX_FILENAME_LENGTH} characters)`
      );
    }

    // Original file name validation
    const origFileNameValidation = this.validationService.validateRequired(
      data.original_file_name,
      'Original file name'
    );
    if (!origFileNameValidation.isValid) {
      errors.push(...origFileNameValidation.errors);
    } else if (data.original_file_name.length > MAX_FILENAME_LENGTH) {
      errors.push(
        `Original file name too long (max ${MAX_FILENAME_LENGTH} characters)`
      );
    }

    // File type validation
    const fileTypeValidation = this.validationService.validateRequired(
      data.original_file_type,
      'File type'
    );
    if (!fileTypeValidation.isValid) {
      errors.push(...fileTypeValidation.errors);
    } else if (!ALLOWED_AUDIO_TYPES.includes(data.original_file_type.toLowerCase())) {
      errors.push(
        `Unsupported file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`
      );
    }

    // File size validation
    const fileSizeValidation = this.validationService.validateFileSize(data.file_size);
    if (!fileSizeValidation.isValid) {
      errors.push(...fileSizeValidation.errors);
    }

    // Optional field validation
    if (data.title && data.title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title too long (max ${MAX_TITLE_LENGTH} characters)`);
    }

    if (data.duration !== undefined) {
      const durationValidation = this.validationService.validateNumber(
        data.duration,
        'Duration',
        { min: 0 }
      );
      if (!durationValidation.isValid) {
        errors.push(...durationValidation.errors);
      }
    }

    // Location validation
    if (data.latitude !== undefined) {
      const latitudeValidation = this.validationService.validateNumber(
        data.latitude,
        'Latitude',
        { min: -90, max: 90 }
      );
      if (!latitudeValidation.isValid) {
        errors.push(...latitudeValidation.errors);
      }
    }

    if (data.longitude !== undefined) {
      const longitudeValidation = this.validationService.validateNumber(
        data.longitude,
        'Longitude',
        { min: -180, max: 180 }
      );
      if (!longitudeValidation.isValid) {
        errors.push(...longitudeValidation.errors);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  async getAllFiles(): Promise<AudioFile[]> {
    try {
      const files = await this.audioRepository.findAll();
      debugLog('service', `Found ${files.length} audio files`);
      return files;
    } catch (error) {
      debugLog('service', 'Error getting all files:', error);
      throw error;
    }
  }

  async getFileById(id: number): Promise<AudioFile | null> {
    try {
      const idValidation = this.validationService.validateId(id, 'File ID');
      if (!idValidation.isValid) {
        throw new Error(idValidation.errors.join(', '));
      }
      return await this.audioRepository.findById(id);
    } catch (error) {
      debugLog('service', `Error getting file ${id}:`, error);
      throw error;
    }
  }

  async createFile(data: NewAudioFile): Promise<AudioFile> {
    try {
      // Comprehensive validation
      this.validateAudioFileData(data);

      const newFile = await this.audioRepository.create(data);
      debugLog('service', `Created audio file with ID: ${newFile.id}`);
      return newFile;
    } catch (error) {
      debugLog('service', 'Error creating file:', error);
      throw error;
    }
  }

  async updateFile(
    id: number,
    data: Partial<NewAudioFile>
  ): Promise<AudioFile> {
    try {
      const idValidation = this.validationService.validateId(id, 'File ID');
      if (!idValidation.isValid) {
        throw new Error(idValidation.errors.join(', '));
      }

      // Validate update data (only validate provided fields)
      if (Object.keys(data).length > 0) {
        const errors: string[] = [];

        // Only validate the specific fields being updated
        if (data.file_name !== undefined) {
          const validation = this.validationService.validateRequired(
            data.file_name,
            'File name'
          );
          if (!validation.isValid) {
            errors.push(...validation.errors);
          } else if (data.file_name.length > MAX_FILENAME_LENGTH) {
            errors.push('File name too long for update');
          }
        }

        if (data.original_file_name !== undefined) {
          const validation = this.validationService.validateRequired(
            data.original_file_name,
            'Original file name'
          );
          if (!validation.isValid) {
            errors.push(...validation.errors);
          } else if (data.original_file_name.length > MAX_FILENAME_LENGTH) {
            errors.push('Original file name too long for update');
          }
        }

        if (data.original_file_type !== undefined) {
          if (!ALLOWED_AUDIO_TYPES.includes(data.original_file_type.toLowerCase())) {
            errors.push(
              `Unsupported file type for update. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`
            );
          }
        }

        if (data.file_size !== undefined) {
          const validation = this.validationService.validateFileSize(data.file_size);
          if (!validation.isValid) {
            errors.push(...validation.errors);
          }
        }

        if (data.title !== undefined && data.title && data.title.length > MAX_TITLE_LENGTH) {
          errors.push(
            `Title too long for update (max ${MAX_TITLE_LENGTH} characters)`
          );
        }

        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
      }

      const updatedFile = await this.audioRepository.update(id, data);
      debugLog('service', `Updated audio file ${id}`);
      return updatedFile;
    } catch (error) {
      debugLog('service', `Error updating file ${id}:`, error);
      throw error;
    }
  }

  async deleteFile(id: number): Promise<boolean> {
    try {
      const idValidation = this.validationService.validateId(id, 'File ID');
      if (!idValidation.isValid) {
        throw new Error(idValidation.errors.join(', '));
      }

      const deleted = await this.audioRepository.delete(id);
      if (deleted) {
        debugLog('service', `Deleted audio file ${id}`);
      } else {
        debugLog('service', `Audio file ${id} not found for deletion`);
      }
      return deleted;
    } catch (error) {
      debugLog('service', `Error deleting file ${id}:`, error);
      throw error;
    }
  }

  async checkForDuplicates(data: {
    fileHash: string;
    originalFileName: string;
    fileSize: number;
  }): Promise<{
    isDuplicate: boolean;
    duplicateType?: string;
    message?: string;
    existingFile?: AudioFile;
  }> {
    try {
      const errors: string[] = [];

      const hashValidation = this.validationService.validateRequired(
        data.fileHash,
        'File hash'
      );
      if (!hashValidation.isValid) {
        errors.push(...hashValidation.errors);
      }

      const fileNameValidation = this.validationService.validateRequired(
        data.originalFileName,
        'Original file name'
      );
      if (!fileNameValidation.isValid) {
        errors.push(...fileNameValidation.errors);
      }

      const fileSizeValidation = this.validationService.validateNumber(
        data.fileSize,
        'File size',
        { min: 1 }
      );
      if (!fileSizeValidation.isValid) {
        errors.push(...fileSizeValidation.errors);
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      const existingFile = await this.audioRepository.findByHash(data.fileHash);
      if (existingFile) {
        if (
          existingFile.file_size === data.fileSize &&
          existingFile.original_file_name === data.originalFileName
        ) {
          return {
            isDuplicate: true,
            duplicateType: 'full',
            message: 'An identical file has already been uploaded.',
            existingFile,
          };
        }
        return {
          isDuplicate: true,
          duplicateType: 'hash',
          message:
            'A file with the same content but different metadata exists.',
          existingFile,
        };
      }
      return { isDuplicate: false };
    } catch (error) {
      debugLog('service', 'Error checking duplicates:', error);
      throw error;
    }
  }

  async getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    averageDuration: number;
  }> {
    try {
      const stats = await this.audioStatsRepository.getStorageStats();
      return {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
        averageDuration: stats.totalDuration,
      };
    } catch (error) {
      debugLog('service', 'Error getting statistics:', error);
      throw error;
    }
  }

  async findByHash(hash: string): Promise<AudioFile | null> {
    try {
      const validation = this.validationService.validateRequired(hash, 'Hash');
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return await this.audioRepository.findByHash(hash);
    } catch (error) {
      debugLog('service', `Error finding file by hash:`, error);
      throw error;
    }
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    try {
      const validation = this.validationService.validateRequired(
        fileName,
        'File name'
      );
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return await this.audioRepository.findByFileName(fileName);
    } catch (error) {
      debugLog('service', `Error finding file by name:`, error);
      throw error;
    }
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    try {
      const validation = this.validationService.validateNumber(
        limit,
        'Limit',
        { min: 1 }
      );
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return await this.audioRepository.findRecent(limit);
    } catch (error) {
      debugLog('service', 'Error finding recent files:', error);
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    try {
      const errors: string[] = [];

      const startDateValidation = this.validationService.validateRequired(
        startDate,
        'Start date'
      );
      if (!startDateValidation.isValid) {
        errors.push(...startDateValidation.errors);
      }

      const endDateValidation = this.validationService.validateRequired(
        endDate,
        'End date'
      );
      if (!endDateValidation.isValid) {
        errors.push(...endDateValidation.errors);
      }

      if (startDate > endDate) {
        errors.push('Start date must be before end date');
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      return await this.audioRepository.findByDateRange(startDate, endDate);
    } catch (error) {
      debugLog('service', 'Error finding files by date range:', error);
      throw error;
    }
  }

  async getAllFilesWithDetails(): Promise<
    Array<{
      id: string;
      filename: string;
      originalName: string;
      size: number;
      mimeType: string;
      createdAt: Date;
      updatedAt: Date;
      transcriptionStatus:
        | 'pending'
        | 'processing'
        | 'completed'
        | 'failed'
        | 'draft';
      hasTranscript: boolean;
      hasAiExtract: boolean;
      extractCount: number;
      duration?: number;
    }>
  > {
    try {
      // Get all files
      const files = await this.audioRepository.findAll();

      // Transform files with related data
      const transformedFiles = await Promise.all(
        files.map(async file => {
          // Get transcription status
          const transcriptionJob =
            await this.transcriptionRepository.findLatestByFileId(file.id);
          const transcriptionStatus = transcriptionJob?.status || 'pending';
          const hasTranscript =
            transcriptionStatus === 'completed' &&
            !!transcriptionJob?.transcript;

          // Extractions feature removed - set to 0
          const extractCount = 0;

          return {
            id: file.id.toString(),
            filename: file.file_name,
            originalName: file.original_file_name,
            size: file.file_size,
            mimeType: file.original_file_type,
            createdAt: new Date(file.uploaded_at),
            updatedAt: new Date(file.updated_at),
            transcriptionStatus: transcriptionStatus as
              | 'pending'
              | 'processing'
              | 'completed'
              | 'failed'
              | 'draft',
            hasTranscript,
            hasAiExtract: extractCount > 0,
            extractCount,
            duration: file.duration ?? undefined,
          };
        })
      );

      debugLog(
        'service',
        `Retrieved ${transformedFiles.length} files with details`
      );
      return transformedFiles;
    } catch (error) {
      debugLog('service', 'Error getting files with details:', error);
      throw error;
    }
  }
}