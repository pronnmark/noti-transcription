import { RepositoryFactory } from '../../database/repositories';
import type { AudioRepository } from '../../database/repositories/AudioRepository';
import type { AudioFile } from '../../database/client';

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
  private audioRepository: AudioRepository;

  constructor() {
    this.audioRepository = RepositoryFactory.audioRepository;
  }

  /**
   * Validate audio file data before creation
   */
  private validateAudioFileData(data: NewAudioFile): void {
    // File name validation
    if (!data.file_name?.trim()) {
      throw new Error('File name is required');
    }
    if (data.file_name.length > MAX_FILENAME_LENGTH) {
      throw new Error(
        `File name too long (max ${MAX_FILENAME_LENGTH} characters)`
      );
    }

    // Original file name validation
    if (!data.original_file_name?.trim()) {
      throw new Error('Original file name is required');
    }
    if (data.original_file_name.length > MAX_FILENAME_LENGTH) {
      throw new Error(
        `Original file name too long (max ${MAX_FILENAME_LENGTH} characters)`
      );
    }

    // File type validation
    if (!data.original_file_type?.trim()) {
      throw new Error('File type is required');
    }
    if (!ALLOWED_AUDIO_TYPES.includes(data.original_file_type.toLowerCase())) {
      throw new Error(
        `Unsupported file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`
      );
    }

    // File size validation
    if (typeof data.file_size !== 'number' || data.file_size <= 0) {
      throw new Error('File size must be a positive number');
    }
    if (data.file_size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`
      );
    }

    // Optional field validation
    if (data.title && data.title.length > MAX_TITLE_LENGTH) {
      throw new Error(`Title too long (max ${MAX_TITLE_LENGTH} characters)`);
    }

    if (
      data.duration !== undefined &&
      (typeof data.duration !== 'number' || data.duration < 0)
    ) {
      throw new Error('Duration must be a non-negative number');
    }

    // Location validation
    if (
      data.latitude !== undefined &&
      (typeof data.latitude !== 'number' ||
        data.latitude < -90 ||
        data.latitude > 90)
    ) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }

    if (
      data.longitude !== undefined &&
      (typeof data.longitude !== 'number' ||
        data.longitude < -180 ||
        data.longitude > 180)
    ) {
      throw new Error('Longitude must be between -180 and 180 degrees');
    }
  }

  async getAllFiles(): Promise<AudioFile[]> {
    try {
      const files = await this.audioRepository.findAll();
      console.log(`[AudioService] Found ${files.length} audio files`);
      return files;
    } catch (error) {
      console.error('[AudioService] Error getting all files:', error);
      throw error;
    }
  }

  async getFileById(id: number): Promise<AudioFile | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid file ID is required');
      }
      return await this.audioRepository.findById(id);
    } catch (error) {
      console.error(`[AudioService] Error getting file ${id}:`, error);
      throw error;
    }
  }

  async createFile(data: NewAudioFile): Promise<AudioFile> {
    try {
      // Comprehensive validation
      this.validateAudioFileData(data);

      const newFile = await this.audioRepository.create(data);
      console.log(`[AudioService] Created audio file with ID: ${newFile.id}`);
      return newFile;
    } catch (error) {
      console.error('[AudioService] Error creating file:', error);
      throw error;
    }
  }

  async updateFile(
    id: number,
    data: Partial<NewAudioFile>
  ): Promise<AudioFile> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid file ID is required');
      }

      // Validate update data (only validate provided fields)
      if (Object.keys(data).length > 0) {
        // Create a temporary complete object for validation
        // We'll validate only the fields that are being updated
        const tempData = {
          file_name: data.file_name || 'temp.mp3',
          original_file_name: data.original_file_name || 'temp.mp3',
          original_file_type: data.original_file_type || 'audio/mpeg',
          file_size: data.file_size || 1024,
          ...data,
        } as NewAudioFile;

        // Only validate the specific fields being updated
        if (data.file_name !== undefined) {
          if (
            !data.file_name?.trim() ||
            data.file_name.length > MAX_FILENAME_LENGTH
          ) {
            throw new Error('Invalid file name for update');
          }
        }
        if (data.original_file_name !== undefined) {
          if (
            !data.original_file_name?.trim() ||
            data.original_file_name.length > MAX_FILENAME_LENGTH
          ) {
            throw new Error('Invalid original file name for update');
          }
        }
        if (data.original_file_type !== undefined) {
          if (
            !ALLOWED_AUDIO_TYPES.includes(data.original_file_type.toLowerCase())
          ) {
            throw new Error(
              `Unsupported file type for update. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`
            );
          }
        }
        if (data.file_size !== undefined) {
          if (
            typeof data.file_size !== 'number' ||
            data.file_size <= 0 ||
            data.file_size > MAX_FILE_SIZE
          ) {
            throw new Error('Invalid file size for update');
          }
        }
        if (
          data.title !== undefined &&
          data.title &&
          data.title.length > MAX_TITLE_LENGTH
        ) {
          throw new Error(
            `Title too long for update (max ${MAX_TITLE_LENGTH} characters)`
          );
        }
      }

      const updatedFile = await this.audioRepository.update(id, data);
      console.log(`[AudioService] Updated audio file ${id}`);
      return updatedFile;
    } catch (error) {
      console.error(`[AudioService] Error updating file ${id}:`, error);
      throw error;
    }
  }

  async deleteFile(id: number): Promise<boolean> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid file ID is required');
      }

      const deleted = await this.audioRepository.delete(id);
      if (deleted) {
        console.log(`[AudioService] Deleted audio file ${id}`);
      } else {
        console.warn(`[AudioService] Audio file ${id} not found for deletion`);
      }
      return deleted;
    } catch (error) {
      console.error(`[AudioService] Error deleting file ${id}:`, error);
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
      if (!data.fileHash || !data.originalFileName || !data.fileSize) {
        throw new Error('Required duplicate check data is missing');
      }
      if (data.fileSize <= 0) {
        throw new Error('File size must be positive');
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
      console.error('[AudioService] Error checking duplicates:', error);
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
      const stats = await this.audioRepository.getStorageStats();
      return {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
        averageDuration: stats.totalDuration,
      };
    } catch (error) {
      console.error('[AudioService] Error getting statistics:', error);
      throw error;
    }
  }

  async findByHash(hash: string): Promise<AudioFile | null> {
    try {
      if (!hash) {
        throw new Error('Hash is required');
      }
      return await this.audioRepository.findByHash(hash);
    } catch (error) {
      console.error(`[AudioService] Error finding file by hash:`, error);
      throw error;
    }
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    try {
      if (!fileName) {
        throw new Error('File name is required');
      }
      return await this.audioRepository.findByFileName(fileName);
    } catch (error) {
      console.error(`[AudioService] Error finding file by name:`, error);
      throw error;
    }
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    try {
      if (limit <= 0) {
        throw new Error('Limit must be positive');
      }
      return await this.audioRepository.findRecent(limit);
    } catch (error) {
      console.error('[AudioService] Error finding recent files:', error);
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    try {
      if (!startDate || !endDate) {
        throw new Error('Start and end dates are required');
      }
      if (startDate > endDate) {
        throw new Error('Start date must be before end date');
      }
      return await this.audioRepository.findByDateRange(startDate, endDate);
    } catch (error) {
      console.error('[AudioService] Error finding files by date range:', error);
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

      // Get related repositories directly
      const transcriptionRepository = RepositoryFactory.transcriptionRepository;

      // Transform files with related data
      const transformedFiles = await Promise.all(
        files.map(async file => {
          // Get transcription status
          const transcriptionJob =
            await transcriptionRepository.findLatestByFileId(file.id);
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

      console.log(
        `[AudioService] Retrieved ${transformedFiles.length} files with details`
      );
      return transformedFiles;
    } catch (error) {
      console.error('[AudioService] Error getting files with details:', error);
      throw error;
    }
  }
}
