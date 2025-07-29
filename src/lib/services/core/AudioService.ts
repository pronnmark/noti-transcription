import { RepositoryFactory } from '../../database/repositories';
import type { AudioRepository } from '../../database/repositories/AudioRepository';
import type { AudioFile, NewAudioFile } from '../../database/schema';

export class AudioService {
  private audioRepository: AudioRepository;

  constructor() {
    this.audioRepository = RepositoryFactory.audioRepository;
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
      if (
        !data.fileName ||
        !data.originalFileName ||
        !data.originalFileType ||
        !data.fileSize
      ) {
        throw new Error('Required file data is missing');
      }
      if (data.fileSize <= 0) {
        throw new Error('File size must be positive');
      }

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
    data: Partial<NewAudioFile>,
  ): Promise<AudioFile> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid file ID is required');
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
          existingFile.fileSize === data.fileSize &&
          existingFile.originalFileName === data.originalFileName
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
      return await this.audioRepository.getStatistics();
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
      const extractionRepository = RepositoryFactory.extractionRepository;

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

          // Get extraction count
          const extracts = await extractionRepository.findByFileId(file.id);
          const extractCount = extracts.length;

          return {
            id: file.id.toString(),
            filename: file.fileName,
            originalName: file.originalFileName,
            size: file.fileSize,
            mimeType: file.originalFileType,
            createdAt: file.uploadedAt,
            updatedAt: file.updatedAt,
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
        }),
      );

      console.log(
        `[AudioService] Retrieved ${transformedFiles.length} files with details`,
      );
      return transformedFiles;
    } catch (error) {
      console.error('[AudioService] Error getting files with details:', error);
      throw error;
    }
  }
}
